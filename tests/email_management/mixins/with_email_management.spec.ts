/*
 * @fosterin/persona
 *
 * (C) Foster Studio
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column } from '@adonisjs/lucid/orm'

import { createDatabase, createTables, timeTravel } from '../../helpers.js'
import { EmailVerificationToken } from '../../../src/email_management/email_verification_token.js'
import { withEmailManagement } from '../../../src/email_management/mixins/lucid.js'

test.group('With email management | createToken', () => {
  test('generate email verification token for the user', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends compose(BaseModel, withEmailManagement()) {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare password: string
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await user.createEmailVerificationToken()
    assert.instanceOf(token, EmailVerificationToken)
    assert.equal(token.tokenableId, user.id)
    assert.equal(token.email, user.unverifiedEmail)
  })

  test('wrap token db query inside a transaction', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends compose(BaseModel, withEmailManagement()) {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare password: string
    }

    const trx = await db.transaction()
    const user = await User.create(
      {
        email: 'virk@adonisjs.com',
        unverifiedEmail: 'virk@adonisjs.com',
        username: 'virk',
        password: 'secret',
      },
      { client: trx }
    )

    await user.createEmailVerificationToken()
    await trx.rollback()

    const tokens = await db.query().from('email_verification_tokens')
    assert.lengthOf(tokens, 0)
  })

  test('throw error when unverified email is not set', async ({ assert, cleanup }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends compose(BaseModel, withEmailManagement()) {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare password: string
    }

    const trx = await db.transaction()
    cleanup(() => trx.rollback())

    const user = await User.create(
      {
        email: 'virk@adonisjs.com',
        username: 'virk',
        password: 'secret',
      },
      { client: trx }
    )

    await assert.rejects(
      () => user.createEmailVerificationToken(),
      'Cannot generate email verification token. The value of "User.unverifiedEmail" is undefined or null'
    )
  })

  test('do not create fresh token within throttle window', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends compose(BaseModel, withEmailManagement()) {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare password: string
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await user.createEmailVerificationToken(true)
    assert.instanceOf(token, EmailVerificationToken)

    const token1 = await user.createEmailVerificationToken(true)
    assert.isNull(token1)
  })

  test('create fresh token when throttle window has lapsed', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends compose(BaseModel, withEmailManagement()) {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare password: string
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await user.createEmailVerificationToken(true)
    assert.instanceOf(token, EmailVerificationToken)

    timeTravel(61)
    const token1 = await user.createEmailVerificationToken(true)
    assert.instanceOf(token1, EmailVerificationToken)
  })

  test('create fresh token within throttle window when throttling is disabled', async ({
    assert,
  }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends compose(BaseModel, withEmailManagement()) {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare password: string
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })

    const token = await user.createEmailVerificationToken(false)
    assert.instanceOf(token, EmailVerificationToken)

    const token1 = await user.createEmailVerificationToken(false)
    assert.instanceOf(token1, EmailVerificationToken)
  })
})

test.group('With email management | hasEmailChanged', () => {
  test('check if user email has been changed', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends compose(BaseModel, withEmailManagement()) {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare password: string
    }

    const user = new User()
    user.email = 'foo@bar.com'

    /**
     * No unverified email exists, hence we check against the
     * main email
     */
    assert.isFalse(user.hasEmailChanged('foo@bar.com'))
    assert.isTrue(user.hasEmailChanged('foo@baz.com'))

    user.unverifiedEmail = 'foo@baz.com'
    assert.isTrue(user.hasEmailChanged('foo@bar.com'))
    assert.isFalse(user.hasEmailChanged('foo@baz.com'))
  })
})

test.group('With email management | hasEmailReverted', () => {
  test('check if user email has been reverted', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends compose(BaseModel, withEmailManagement()) {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare password: string
    }

    const user = new User()
    user.email = 'foo@bar.com'

    /**
     * The method should always return false unless an unverified
     * does not exists. Because, fundamentally, reverting an email
     * means going from unverified email to verified.
     */
    assert.isFalse(user.hasEmailReverted('foo@bar.com'))
    assert.isFalse(user.hasEmailReverted('foo@baz.com'))

    /**
     * Should return true when going back to verified email
     */
    user.unverifiedEmail = 'foo@baz.com'
    assert.isTrue(user.hasEmailReverted('foo@bar.com'))
    assert.isFalse(user.hasEmailReverted('foo@baz.com'))
    assert.isFalse(user.hasEmailReverted('foo@foo.com'))
  })
})

test.group('With email management | clearEmailVerificationTokens', () => {
  test('delete all tokens for the user', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends compose(BaseModel, withEmailManagement()) {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare password: string
    }

    const user = await User.create({
      email: 'virk@adonisjs.com',
      unverifiedEmail: 'virk@adonisjs.com',
      username: 'virk',
      password: 'secret',
    })
    await user.createEmailVerificationToken()

    const user1 = await User.create({
      email: 'romain@adonisjs.com',
      unverifiedEmail: 'romain@adonisjs.com',
      username: 'romain',
      password: 'secret',
    })

    await user.createEmailVerificationToken()
    await user1.createEmailVerificationToken()

    await user.clearEmailVerificationTokens()
    assert.lengthOf(await User.emailVerificationTokens.all(user), 0)
    assert.lengthOf(await User.emailVerificationTokens.all(user1), 1)
  })
})

test.group('With email management | withEmail', () => {
  test('update local attributes with new email', async ({ assert }) => {
    const db = await createDatabase()
    await createTables(db)

    class User extends compose(BaseModel, withEmailManagement()) {
      @column({ isPrimary: true })
      declare id: number

      @column()
      declare username: string

      @column()
      declare password: string
    }

    const user = new User()
    user.email = 'foo@bar.com'
    user.withEmail('foo@baz.com')

    assert.equal(user.email, 'foo@bar.com')
    assert.equal(user.unverifiedEmail, 'foo@baz.com')

    const user1 = new User()
    user1.email = 'foo@bar.com'
    user1.unverifiedEmail = 'foo@bar.com'
    user1.withEmail('foo@baz.com')

    assert.equal(user1.email, 'foo@baz.com')
    assert.equal(user1.unverifiedEmail, 'foo@baz.com')
  })
})
