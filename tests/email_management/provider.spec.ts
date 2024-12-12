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
import { EmailVerificationToken } from '../../src/email_management/email_verification_token.js'
import { DbEmailTokensProvider } from '../../src/email_management/token_providers/db.js'

test.group('Email tokens | create', () => {
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

      static emailVerificationTokens = DbEmailTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await User.emailVerificationTokens.create(user, user.email, {
      expiresIn: '20 mins',
    })
    assert.exists(token.identifier)
    assert.instanceOf(token, EmailVerificationToken)
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

      static emailVerificationTokens = DbEmailTokensProvider.forModel(User)
    }

    const user = new User()
    await assert.rejects(
      () => User.emailVerificationTokens.create(user, user.email),
      'Cannot use "User" model for managing email verification tokens. The value of column "id" is undefined or null'
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

      static emailVerificationTokens = DbEmailTokensProvider.forModel(User)
    }

    await assert.rejects(
      // @ts-expect-error
      () => User.emailVerificationTokens.create({}, 'foo@bar.com'),
      'Invalid user object. It must be an instance of the "User" model'
    )
  })
})

test.group('Email tokens | verify', () => {
  test('return email verification token when token value is valid', async ({ assert }) => {
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

      static emailVerificationTokens = DbEmailTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await User.emailVerificationTokens.create(user, user.email)
    const freshToken = await User.emailVerificationTokens.verify(new Secret(token.value!.release()))

    assert.instanceOf(freshToken, EmailVerificationToken)
    assert.isUndefined(freshToken!.value)
    assert.equal(freshToken!.hash, token.hash)
    assert.equal(freshToken?.email, user.email)
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

      static emailVerificationTokens = DbEmailTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await User.emailVerificationTokens.create(user, user.email, {
      expiresIn: '20 mins',
    })
    timeTravel(21 * 60)

    const freshToken = await User.emailVerificationTokens.verify(new Secret(token.value!.release()))
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

      static emailVerificationTokens = DbEmailTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await User.emailVerificationTokens.create(user, user.email)
    await User.emailVerificationTokens.delete(user, token.identifier)

    const freshToken = await User.emailVerificationTokens.verify(new Secret(token.value!.release()))
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

      static emailVerificationTokens = DbEmailTokensProvider.forModel(User)
    }

    const freshToken = await User.emailVerificationTokens.verify(new Secret('foo.bar'))
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

      static emailVerificationTokens = DbEmailTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await User.emailVerificationTokens.create(user, user.email)
    const value = token.value!.release()
    const [identifier] = value.split('.')

    const freshToken = await User.emailVerificationTokens.verify(new Secret(`${identifier}.bar`))
    assert.isNull(freshToken)
  })
})

test.group('Email tokens | find', () => {
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

      static emailVerificationTokens = DbEmailTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await User.emailVerificationTokens.create(user, user.email)
    const freshToken = await User.emailVerificationTokens.find(user, token.identifier)

    assert.exists(freshToken!.identifier)
    assert.instanceOf(freshToken, EmailVerificationToken)
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

      static emailVerificationTokens = DbEmailTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await User.emailVerificationTokens.create(user, user.email, {
      expiresIn: '20 mins',
    })
    timeTravel(21 * 60)
    const freshToken = await User.emailVerificationTokens.find(user, token.identifier)

    assert.exists(freshToken!.identifier)
    assert.instanceOf(freshToken, EmailVerificationToken)
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

      static emailVerificationTokens = DbEmailTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const freshToken = await User.emailVerificationTokens.find(user, 2)
    assert.isNull(freshToken)
  })
})

test.group('Email tokens | all', () => {
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

      static emailVerificationTokens = DbEmailTokensProvider.forModel(User)
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    await User.emailVerificationTokens.create(user, user.email, {
      expiresIn: '20 mins',
    })
    await setTimeout(100)
    await User.emailVerificationTokens.create(user, user.email)
    timeTravel(21 * 60)
    const tokens = await User.emailVerificationTokens.all(user)

    assert.lengthOf(tokens, 2)

    assert.exists(tokens[0].identifier)
    assert.instanceOf(tokens[0], EmailVerificationToken)
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

test.group('Email tokens | deleteAll', () => {
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

      static emailVerificationTokens = DbEmailTokensProvider.forModel(User)
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

    await User.emailVerificationTokens.create(user, user.email)
    await User.emailVerificationTokens.create(user, user.email)
    await User.emailVerificationTokens.create(user1, user1.email)

    await User.emailVerificationTokens.deleteAll(user)
    assert.lengthOf(await User.emailVerificationTokens.all(user), 0)
    assert.lengthOf(await User.emailVerificationTokens.all(user1), 1)
  })
})

test.group('Email tokens | lastCreatedAt', () => {
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

      static emailVerificationTokens = DbEmailTokensProvider.forModel(User)
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

    await User.emailVerificationTokens.create(user, user.email)
    await setTimeout(1000)
    const token2 = await User.emailVerificationTokens.create(user, user.email)
    const token3 = await User.emailVerificationTokens.create(user1, user1.email)

    const lastTokenForUser = await User.emailVerificationTokens.lastCreatedAt(user)
    const lastTokenForUser1 = await User.emailVerificationTokens.lastCreatedAt(user1)
    assert.equal(lastTokenForUser?.getTime(), token2.createdAt.getTime())
    assert.equal(lastTokenForUser1?.getTime(), token3.createdAt.getTime())
    assert.isNull(await User.emailVerificationTokens.lastCreatedAt(user2))
  })
})
