/*
 * @adonisjs/persona
 *
 * (C) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column } from '@adonisjs/lucid/orm'

import { createDatabase, createTables, timeTravel } from '../../helpers.js'
import { withPasswordManagement } from '../../../src/password_management/mixins/lucid.js'
import { PasswordResetToken } from '../../../src/password_management/password_reset_token.js'

test.group('With password management | createToken', () => {
  test('generate password reset token for the user', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends compose(BaseModel, withPasswordManagement()) {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await user.createPasswordResetToken()
    assert.instanceOf(token, PasswordResetToken)
    assert.equal(token.tokenableId, user.id)
  })

  test('wrap token db query inside a transaction', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends compose(BaseModel, withPasswordManagement()) {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string
    }

    const trx = await db.transaction()
    const user = await User.create(
      {
        email: 'virk@adonisjs.com',
        username: 'virk',
        password: 'secret',
      },
      { client: trx }
    )

    await user.createPasswordResetToken()
    await trx.rollback()

    const tokens = await db.query().from('password_reset_tokens')
    assert.lengthOf(tokens, 0)
  })

  test('do not create fresh token within throttle window', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends compose(BaseModel, withPasswordManagement()) {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await user.createPasswordResetToken(true)
    assert.instanceOf(token, PasswordResetToken)

    const token1 = await user.createPasswordResetToken(true)
    assert.isNull(token1)
  })

  test('create fresh token when throttle window has lapsed', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends compose(BaseModel, withPasswordManagement()) {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await user.createPasswordResetToken(true)
    assert.instanceOf(token, PasswordResetToken)

    timeTravel(61)
    const token1 = await user.createPasswordResetToken(true)
    assert.instanceOf(token1, PasswordResetToken)
  })

  test('create fresh token within throttle window when throttling is disabled', async ({
    assert,
  }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends compose(BaseModel, withPasswordManagement()) {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await user.createPasswordResetToken(false)
    assert.instanceOf(token, PasswordResetToken)

    const token1 = await user.createPasswordResetToken(false)
    assert.instanceOf(token1, PasswordResetToken)
  })
})

test.group('With email management | clearPasswordResetTokens', () => {
  test('delete all tokens for the user', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends compose(BaseModel, withPasswordManagement()) {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })
    await user.createPasswordResetToken()
    await user.createPasswordResetToken()

    const user1 = await User.create({
      email: 'romain@adonisjs.com',
      username: 'romain',
      password: 'secret',
    })
    await user1.createPasswordResetToken()

    await user.clearPasswordResetTokens()
    assert.lengthOf(await User.passwordResetTokens.all(user), 0)
    assert.lengthOf(await User.passwordResetTokens.all(user1), 1)
  })
})
