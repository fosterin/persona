/*
 * @adonisjs/persona
 *
 * (C) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { createError } from '@adonisjs/core/exceptions'

export const E_INVALID_EMAIL_TOKEN = createError(
  'Invalid or expired email verification token',
  'E_INVALID_EMAIL_TOKEN',
  400
)
