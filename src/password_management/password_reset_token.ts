/*
 * @adonisjs/persona
 *
 * (C) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { type Secret, VerificationToken } from '@adonisjs/core/helpers'

/**
 * PasswordResetToken represents an opaque token that can be
 * used to perform a password reset without knowing the
 * existing password
 */
export class PasswordResetToken extends VerificationToken {
  /**
   * Date/time when the token instance was created
   */
  createdAt: Date

  constructor(attributes: {
    identifier: string | number | BigInt
    tokenableId: string | number | BigInt
    hash: string
    createdAt: Date
    expiresAt: Date
    secret?: Secret<string>
  }) {
    super()
    this.identifier = attributes.identifier
    this.tokenableId = attributes.tokenableId
    this.hash = attributes.hash
    this.createdAt = attributes.createdAt
    this.expiresAt = attributes.expiresAt

    /**
     * Compute value when secret is provided
     */
    if (attributes.secret) {
      this.computeValue(attributes.secret)
    }
  }
}
