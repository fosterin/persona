/*
 * @adonisjs/persona
 *
 * (C) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { I18n } from '@adonisjs/i18n'
import { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'

/**
 * The error is thrown when trying to reset the password
 * using a verification token and the token is either
 * invalid or expired.
 */
export const E_INVALID_PASSWORD_TOKEN = class extends Exception {
  static status: number = 400
  static code: string = 'E_INVALID_PASSWORD_TOKEN'
  static message: string = 'Invalid or expired password reset token'

  /**
   * Translation identifier. Can be customized
   */
  identifier: string = 'errors.E_INVALID_PASSWORD_TOKEN'

  /**
   * Returns the message to be sent in the HTTP response.
   * Feel free to override this method and return a custom
   * response.
   */
  getResponseMessage(error: this, ctx: HttpContext) {
    if ('i18n' in ctx) {
      return (ctx.i18n as I18n).t(error.identifier, {}, error.message)
    }
    return error.message
  }

  /**
   * Converts exception to an HTTP response
   */
  async handle(error: this, ctx: HttpContext) {
    const message = this.getResponseMessage(error, ctx)

    switch (ctx.request.accepts(['html', 'application/vnd.api+json', 'json'])) {
      case 'html':
      case null:
        if (ctx.session) {
          ctx.session.flash('email_verification_error', message)
          ctx.response.redirect('back', true)
        } else {
          ctx.response.status(error.status).send(message)
        }
        break
      case 'json':
        ctx.response.status(error.status).send({
          errors: [
            {
              message,
            },
          ],
        })
        break
      case 'application/vnd.api+json':
        ctx.response.status(error.status).send({
          errors: [
            {
              code: error.code,
              title: message,
            },
          ],
        })
        break
    }
  }
}
