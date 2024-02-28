/*
 * @fosterin/persona
 *
 * (C) Foster Studio
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Exception } from '@adonisjs/core/exceptions'

class InvalidEmailToken extends Exception {
  static message = 'Invalid or expired email verification token'
  static status = 400
  static code = 'E_INVALID_EMAIL_TOKEN'
}

export const E_INVALID_EMAIL_TOKEN = InvalidEmailToken
