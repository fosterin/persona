/*
 * @adonisjs/persona
 *
 * (C) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Secret } from '@adonisjs/core/helpers'
import { BaseModel } from '@adonisjs/lucid/orm'
import stringHelpers from '@adonisjs/core/helpers/string'
import { RuntimeException } from '@adonisjs/core/exceptions'
import type { NormalizeConstructor } from '@adonisjs/core/types/helpers'

import { E_INVALID_EMAIL_TOKEN } from '../../errors.js'
import { DbEmailTokensProvider } from '../token_providers/db.js'
import { EmailVerificationToken } from '../email_verification_token.js'

/**
 * A Lucid mixin to properly manage emails on a model. The mixin
 * adds "email" and "unverifiedEmail" properties on the model.
 * Therefore, you should create these columns inside the
 * database.
 */
export function withEmailManagement() {
  return <Model extends NormalizeConstructor<typeof BaseModel>>(superclass: Model) => {
    class UserWithManagedEmails extends superclass {
      /**
       * The tokens provider to use for creating and verifying email
       * tokens
       */
      declare static emailVerificationTokens: DbEmailTokensProvider<typeof UserWithManagedEmails>

      /**
       * Verifies the user email address by verifying the
       * token
       */
      static async verifyEmail<TokenableModel extends typeof UserWithManagedEmails>(
        this: TokenableModel,
        tokenValue: string
      ): Promise<InstanceType<TokenableModel>> {
        const token = await this.emailVerificationTokens.verify(new Secret(tokenValue))
        if (!token) {
          throw new E_INVALID_EMAIL_TOKEN()
        }

        const transaction = await this.transaction()

        try {
          /**
           * Check if any other user is using the provided
           * email as the primary email on their account.
           *
           * If yes, we cannot overwrite their email address.
           */
          const otherUserWithSameEmail = await this.query({
            client: transaction,
          })
            .where('email', token.email)
            .whereNot(this.primaryKey, String(token.tokenableId))
            .first()

          if (otherUserWithSameEmail) {
            throw new E_INVALID_EMAIL_TOKEN()
          }

          /**
           * Find the user for whom the token the created. Also,
           * the email address for which the token was generated.
           */
          const user = await this.query({
            client: transaction,
          })
            .where(this.primaryKey, String(token.tokenableId))
            .where('unverifiedEmail', token.email)
            .forUpdate()
            .first()

          if (!user) {
            throw new E_INVALID_EMAIL_TOKEN()
          }

          /**
           * Update user email address
           */
          await user.switchEmail(token.email).save()
          await transaction.commit()
          return user
        } catch (error) {
          await transaction.rollback()
          Error.captureStackTrace(error)
          throw error
        }
      }

      /**
       * Boots the model
       */
      static boot() {
        if (!this.hasOwnProperty('booted')) {
          // @ts-expect-error
          this.booted = false
        }

        if (this.booted === true) {
          return
        }

        super.boot()

        /**
         * Define runtime columns
         */
        this.$addColumn('email', {})
        this.$addColumn('unverifiedEmail', {
          columnName: 'unverified_email',
        })

        /**
         * Define email verification tokens as a runtime
         * property
         */
        this.$defineProperty(
          'emailVerificationTokens',
          DbEmailTokensProvider.forModel(this, {}) as any,
          'define'
        )
      }

      /**
       * The email column is used to store emails the primary
       * email for the user account.
       */
      declare email: string

      /**
       * The unverified_email column is used to store unverified
       * email the user wants to associate with their account.
       *
       * During new account creation, the value for both "email"
       * and "unverified_email" columns will be the same.
       */
      declare unverifiedEmail: string | null

      /**
       * Creates an email verification token for the user
       */
      createEmailVerificationToken(
        shouldThrottle: true,
        throttleDuration?: number | string
      ): Promise<EmailVerificationToken | null>
      createEmailVerificationToken(shouldThrottle?: false): Promise<EmailVerificationToken>
      async createEmailVerificationToken(
        shouldThrottle?: boolean,
        throttleDuration: number | string = 60
      ): Promise<EmailVerificationToken | null> {
        const model = this.constructor as typeof UserWithManagedEmails
        const self = this as InstanceType<typeof UserWithManagedEmails>

        /**
         * Ensure the unverified email property exists before creating
         * a new token
         */
        if (!self.unverifiedEmail) {
          throw new RuntimeException(
            `Cannot generate email verification token. The value of "${model.name}.unverifiedEmail" is undefined or null`
          )
        }

        /**
         * Throttle token creation request and return null when a token
         * was generated within the pre-defined throttle window
         */
        if (shouldThrottle) {
          const lastCreatedToken = await model.emailVerificationTokens.lastCreatedAt(self)

          /**
           * There is a token and that token + 60 seconds computes to time
           * greater than now. Therefore we will not create a new token.
           */
          if (
            lastCreatedToken &&
            lastCreatedToken.setSeconds(
              lastCreatedToken.getSeconds() + stringHelpers.seconds.parse(throttleDuration)
            ) > new Date().getTime()
          ) {
            return null
          }

          /**
           * Otherwise create a new token
           */
          return model.emailVerificationTokens.create(self, self.unverifiedEmail)
        }

        return model.emailVerificationTokens.create(self, self.unverifiedEmail)
      }

      /**
       * Deletes all email verification tokens for the user
       */
      clearEmailVerificationTokens(): Promise<number> {
        const model = this.constructor as typeof UserWithManagedEmails
        const self = this as InstanceType<typeof UserWithManagedEmails>
        return model.emailVerificationTokens.deleteAll(self)
      }

      /**
       * Returns a boolean to know if the provided email
       * is different from the current "unverifiedEmail"
       * or "email".
       */
      hasEmailChanged(newEmail: string): boolean {
        /**
         * When the "unverifiedEmail" exists, then we check the new
         * email against it.
         */
        if (this.unverifiedEmail) {
          return this.unverifiedEmail !== newEmail
        }

        /**
         * Otherwise we check it against the primary email
         */
        return this.email !== newEmail
      }

      /**
       * Check if the email address has been reverted
       * back to the original email.
       *
       * - The unverified email should exist.
       * - The value of new email should be same as "email".
       */
      hasEmailReverted(newEmail: string): boolean {
        return !!(this.unverifiedEmail && this.email === newEmail)
      }

      /**
       * Updates local "email" and "unverifiedEmail" attributes.
       * You can chain this method before performing update
       * via the user model.
       */
      withEmail(newEmail: string): this {
        if (this.email === this.unverifiedEmail) {
          this.email = newEmail
          this.unverifiedEmail = newEmail
        } else {
          this.unverifiedEmail = newEmail
        }
        return this
      }

      /**
       * Switch the primary email address of the user. Ideally
       * this method should set the "unverified_email" to
       * null.
       */
      switchEmail(newEmail: string): this {
        this.email = newEmail
        this.unverifiedEmail = null
        return this
      }
    }

    return UserWithManagedEmails
  }
}
