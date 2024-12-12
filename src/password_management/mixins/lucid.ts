/*
 * @adonisjs/persona
 *
 * (C) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { BaseModel } from '@adonisjs/lucid/orm'
import { Secret } from '@adonisjs/core/helpers'
import stringHelpers from '@adonisjs/core/helpers/string'
import type { NormalizeConstructor } from '@adonisjs/core/types/helpers'

import { E_INVALID_PASSWORD_TOKEN } from '../errors.js'
import { PasswordResetToken } from '../password_reset_token.js'
import { DbPasswordTokensProvider } from '../token_providers/db.js'

/**
 * A Lucid mixin to properly manage password on a model. The mixin
 * adds "password" property on the model. Therefore, you should
 * create this columns inside the database.
 */
export function withPasswordManagement() {
  return <Model extends NormalizeConstructor<typeof BaseModel>>(superclass: Model) => {
    class UserWithManagedPassword extends superclass {
      /**
       * The tokens provider to use for creating and verifying
       * password reset tokens
       */
      declare static passwordResetTokens: DbPasswordTokensProvider<typeof UserWithManagedPassword>

      /**
       * Updates the user password using the reset token
       */
      static async resetPassword<TokenableModel extends typeof UserWithManagedPassword>(
        this: TokenableModel,
        tokenValue: string,
        newPassword: string
      ): Promise<InstanceType<TokenableModel>> {
        const token = await this.passwordResetTokens.verify(new Secret(tokenValue))
        if (!token) {
          throw new E_INVALID_PASSWORD_TOKEN()
        }

        return this.transaction(async (trx) => {
          /**
           * Find the user for whom the token was created.
           */
          const user = await this.query({
            client: trx,
          })
            .where(this.primaryKey, String(token.tokenableId))
            .forUpdate()
            .first()

          if (!user) {
            throw new E_INVALID_PASSWORD_TOKEN()
          }

          /**
           * Update the user password. We will rely on the model
           * hooks for hashing the password
           */
          user.password = newPassword
          await user.save()
          return user
        })
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
        this.$addColumn('password', {})

        /**
         * Define password reset tokens as a runtime
         * property
         */
        this.$defineProperty(
          'passwordResetTokens',
          DbPasswordTokensProvider.forModel(this, {}) as any,
          'define'
        )
      }

      /**
       * The password column is used to store the hashed password
       */
      declare password: string

      /**
       * Creates an password reset token for the user for change the
       * password without knowing the old password
       */
      createPasswordResetToken(
        shouldThrottle: true,
        throttleDuration?: number | string
      ): Promise<PasswordResetToken | null>
      createPasswordResetToken(shouldThrottle?: false): Promise<PasswordResetToken>
      async createPasswordResetToken(
        shouldThrottle?: boolean,
        throttleDuration: number | string = 60
      ): Promise<PasswordResetToken | null> {
        const model = this.constructor as typeof UserWithManagedPassword
        const self = this as InstanceType<typeof UserWithManagedPassword>

        /**
         * Throttle token creation request and return null when a token
         * was generated within the pre-defined throttle window
         */
        if (shouldThrottle) {
          const lastCreatedToken = await model.passwordResetTokens.lastCreatedAt(self)

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
          return model.passwordResetTokens.create(self)
        }

        return model.passwordResetTokens.create(self)
      }

      /**
       * Deletes all password reset tokens for the user
       */
      clearPasswordResetTokens(): Promise<number> {
        const model = this.constructor as typeof UserWithManagedPassword
        const self = this as InstanceType<typeof UserWithManagedPassword>
        return model.passwordResetTokens.deleteAll(self)
      }
    }

    return UserWithManagedPassword
  }
}
