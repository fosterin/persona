/*
 * @adonisjs/persona
 *
 * (C) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { Secret } from '@adonisjs/core/helpers'
import { setTimeout } from 'node:timers/promises'
import { BaseModel, column } from '@adonisjs/lucid/orm'

import { createDatabase, createTables, timeTravel } from '../helpers.js'
import { PasswordResetToken } from '../../src/password_management/password_reset_token.js'
import { DbPasswordTokensProvider } from '../../src/password_management/token_providers/db.js'

test.group('Password reset token | create', () => {
  test('create token for a user', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends BaseModel {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string

      @column()
      declare password: string

      static passwordResetTokens = DbPasswordTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await User.passwordResetTokens.create(user, {
      expiresIn: '20 mins',
    })
    assert.exists(token.identifier)
    assert.instanceOf(token, PasswordResetToken)
    assert.equal(token.tokenableId, user.id)
    assert.instanceOf(token.expiresAt, Date)
    assert.instanceOf(token.createdAt, Date)
    assert.isDefined(token.hash)
    assert.exists(token.value)

    assert.isFalse(token.isExpired())
    timeTravel(21 * 60)
    assert.isTrue(token.isExpired())
  })

  test('throw error when user id is missing', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends BaseModel {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string

      @column()
      declare password: string

      static passwordResetTokens = DbPasswordTokensProvider.forModel(User)
    }

    const user = new User()
    await assert.rejects(
      () => User.passwordResetTokens.create(user),
      'Cannot use "User" model for managing password reset tokens. The value of column "id" is undefined or null'
    )
  })

  test('throw error when user is not an instance of the associated model', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends BaseModel {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string

      @column()
      declare password: string

      static passwordResetTokens = DbPasswordTokensProvider.forModel(User)
    }

    await assert.rejects(
      // @ts-expect-error
      () => User.passwordResetTokens.create({}),
      'Invalid user object. It must be an instance of the "User" model'
    )
  })
})

test.group('Password reset tokens | verify', () => {
  test('return password reset token when token value is valid', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends BaseModel {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string

      @column()
      declare password: string

      static passwordResetTokens = DbPasswordTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await User.passwordResetTokens.create(user)
    const freshToken = await User.passwordResetTokens.verify(new Secret(token.value!.release()))

    assert.instanceOf(freshToken, PasswordResetToken)
    assert.isUndefined(freshToken!.value)
    assert.equal(freshToken!.hash, token.hash)
    assert.closeTo(freshToken!.createdAt.getTime(), token.createdAt.getTime(), 10)
    assert.closeTo(freshToken!.expiresAt.getTime(), token.expiresAt.getTime(), 10)
  })

  test('return null when token has been expired', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends BaseModel {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string

      @column()
      declare password: string

      static passwordResetTokens = DbPasswordTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await User.passwordResetTokens.create(user, {
      expiresIn: '20 mins',
    })
    timeTravel(21 * 60)

    const freshToken = await User.passwordResetTokens.verify(new Secret(token.value!.release()))
    assert.isNull(freshToken)
  })

  test('return null when token does not exists', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends BaseModel {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string

      @column()
      declare password: string

      static passwordResetTokens = DbPasswordTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await User.passwordResetTokens.create(user)
    await User.passwordResetTokens.delete(user, token.identifier)

    const freshToken = await User.passwordResetTokens.verify(new Secret(token.value!.release()))
    assert.isNull(freshToken)
  })

  test('return null when token value is invalid', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends BaseModel {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string

      @column()
      declare password: string

      static passwordResetTokens = DbPasswordTokensProvider.forModel(User)
    }

    const freshToken = await User.passwordResetTokens.verify(new Secret('foo.bar'))
    assert.isNull(freshToken)
  })

  test('return null when token secret is invalid', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends BaseModel {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string

      @column()
      declare password: string

      static passwordResetTokens = DbPasswordTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await User.passwordResetTokens.create(user)
    const value = token.value!.release()
    const [identifier] = value.split('.')

    const freshToken = await User.passwordResetTokens.verify(new Secret(`${identifier}.bar`))
    assert.isNull(freshToken)
  })
})

test.group('Password reset tokens | find', () => {
  test('get token by id', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends BaseModel {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string

      @column()
      declare password: string

      static passwordResetTokens = DbPasswordTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await User.passwordResetTokens.create(user)
    const freshToken = await User.passwordResetTokens.find(user, token.identifier)

    assert.exists(freshToken!.identifier)
    assert.instanceOf(freshToken, PasswordResetToken)
    assert.equal(freshToken!.tokenableId, user.id)
    assert.instanceOf(freshToken!.expiresAt, Date)
    assert.instanceOf(freshToken!.createdAt, Date)
    assert.isDefined(freshToken!.hash)
    assert.isUndefined(freshToken!.value)
  })

  test('return expired tokens as well', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends BaseModel {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string

      @column()
      declare password: string

      static passwordResetTokens = DbPasswordTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await User.passwordResetTokens.create(user, {
      expiresIn: '20 mins',
    })
    timeTravel(21 * 60)
    const freshToken = await User.passwordResetTokens.find(user, token.identifier)

    assert.exists(freshToken!.identifier)
    assert.instanceOf(freshToken, PasswordResetToken)
    assert.equal(freshToken!.tokenableId, user.id)
    assert.instanceOf(freshToken!.expiresAt, Date)
    assert.instanceOf(freshToken!.createdAt, Date)

    assert.isDefined(freshToken!.hash)
    assert.isUndefined(freshToken!.value)
    assert.isTrue(freshToken!.isExpired())
  })

  test('return null when token is missing', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends BaseModel {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string

      @column()
      declare password: string

      static passwordResetTokens = DbPasswordTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const freshToken = await User.passwordResetTokens.find(user, 2)
    assert.isNull(freshToken)
  })
})

test.group('Password reset tokens | all', () => {
  test('get list of all tokens order by created_at', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends BaseModel {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string

      @column()
      declare password: string

      static passwordResetTokens = DbPasswordTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    await User.passwordResetTokens.create(user, {
      expiresIn: '20 mins',
    })
    await setTimeout(100)
    await User.passwordResetTokens.create(user)
    timeTravel(21 * 60)
    const tokens = await User.passwordResetTokens.all(user)

    assert.lengthOf(tokens, 2)

    assert.exists(tokens[0].identifier)
    assert.instanceOf(tokens[0], PasswordResetToken)
    assert.equal(tokens[0].tokenableId, user.id)
    assert.instanceOf(tokens[0].expiresAt, Date)
    assert.instanceOf(tokens[0].createdAt, Date)
    assert.isDefined(tokens[0].hash)
    assert.isUndefined(tokens[0].value)
    assert.isFalse(tokens[0].isExpired())

    assert.exists(tokens[1].identifier)
    assert.equal(tokens[1].tokenableId, user.id)
    assert.instanceOf(tokens[1].expiresAt, Date)
    assert.instanceOf(tokens[1].createdAt, Date)
    assert.isDefined(tokens[1].hash)
    assert.isUndefined(tokens[1].value)
    assert.isTrue(tokens[1].isExpired())
  })
})

test.group('Password reset tokens | deleteAll', () => {
  test('delete all tokens for a user', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends BaseModel {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string

      @column()
      declare password: string

      static passwordResetTokens = DbPasswordTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })
    const user1 = await User.create({
      email: 'romain@adonisjs.com',
      username: 'romain',
      password: 'secret',
    })

    await User.passwordResetTokens.create(user)
    await User.passwordResetTokens.create(user)
    await User.passwordResetTokens.create(user1)

    await User.passwordResetTokens.deleteAll(user)
    assert.lengthOf(await User.passwordResetTokens.all(user), 0)
    assert.lengthOf(await User.passwordResetTokens.all(user1), 1)
  })
})

test.group('Password reset tokens | lastCreatedAt', () => {
  test('get timestamp for the last created token', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends BaseModel {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare email: string

      @column()
      declare password: string

      static passwordResetTokens = DbPasswordTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })
    const user1 = await User.create({
      email: 'romain@adonisjs.com',
      username: 'romain',
      password: 'secret',
    })
    const user2 = await User.create({
      email: 'nikk@adonisjs.com',
      username: 'nikk',
      password: 'secret',
    })

    await User.passwordResetTokens.create(user)
    await setTimeout(1000)
    const token2 = await User.passwordResetTokens.create(user)
    const token3 = await User.passwordResetTokens.create(user1)

    const lastTokenForUser = await User.passwordResetTokens.lastCreatedAt(user)
    const lastTokenForUser1 = await User.passwordResetTokens.lastCreatedAt(user1)
    assert.equal(lastTokenForUser?.getTime(), token2.createdAt.getTime())
    assert.equal(lastTokenForUser1?.getTime(), token3.createdAt.getTime())
    assert.isNull(await User.passwordResetTokens.lastCreatedAt(user2))
  })
})
