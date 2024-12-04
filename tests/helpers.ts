/*
 * @adonisjs/persona
 *
 * (C) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'node:path'
import timekeeper from 'timekeeper'
import { mkdir } from 'node:fs/promises'
import { getActiveTest } from '@japa/runner'
import { Emitter } from '@adonisjs/core/events'
import { compose, Secret } from '@adonisjs/core/helpers'
import { Database } from '@adonisjs/lucid/database'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { AppFactory } from '@adonisjs/core/factories/app'
import { LoggerFactory } from '@adonisjs/core/factories/logger'
import { withEmailManagement } from '../src/email_verification/main.js'

/**
 * Creates database connection for testing
 */
export async function createDatabase() {
  const test = getActiveTest()
  if (!test) {
    throw new Error('Cannot use "createDatabase" outside of a Japa test')
  }

  await mkdir(test.context.fs.basePath)

  const app = new AppFactory().create(test.context.fs.baseUrl, () => {})
  const logger = new LoggerFactory().create()
  const emitter = new Emitter(app)
  const db = new Database(
    {
      connection: process.env.DB || 'sqlite',
      connections: {
        sqlite: {
          client: 'sqlite3',
          connection: {
            filename: join(test.context.fs.basePath, 'db.sqlite3'),
          },
        },
        pg: {
          client: 'pg',
          connection: {
            host: process.env.PG_HOST as string,
            port: Number(process.env.PG_PORT),
            database: process.env.PG_DATABASE as string,
            user: process.env.PG_USER as string,
            password: process.env.PG_PASSWORD as string,
          },
        },
        mssql: {
          client: 'mssql',
          connection: {
            server: process.env.MSSQL_HOST as string,
            port: Number(process.env.MSSQL_PORT! as string),
            user: process.env.MSSQL_USER as string,
            password: process.env.MSSQL_PASSWORD as string,
            database: 'master',
            options: {
              enableArithAbort: true,
            },
          },
        },
        mysql: {
          client: 'mysql2',
          connection: {
            host: process.env.MYSQL_HOST as string,
            port: Number(process.env.MYSQL_PORT),
            database: process.env.MYSQL_DATABASE as string,
            user: process.env.MYSQL_USER as string,
            password: process.env.MYSQL_PASSWORD as string,
          },
        },
      },
    },
    logger,
    emitter
  )

  test.cleanup(() => db.manager.closeAll())
  BaseModel.useAdapter(db.modelAdapter())
  return db
}

/**
 * Creates needed database tables
 */
export async function createTables(db: Database) {
  const test = getActiveTest()
  if (!test) {
    throw new Error('Cannot use "createTables" outside of a Japa test')
  }

  test.cleanup(async () => {
    await db.connection().schema.dropTable('users')
    await db.connection().schema.dropTable('email_verification_tokens')
    await db.connection().schema.dropTable('password_reset_tokens')
  })

  await db.connection().schema.createTable('users', (table) => {
    table.increments()
    table.string('username').unique().notNullable()
    table.string('email').unique().notNullable()
    table.string('unverified_email').nullable()
    table.string('password').nullable()
  })

  await db.connection().schema.createTable('email_verification_tokens', (table) => {
    table.increments()
    table.integer('tokenable_id').notNullable().unsigned()
    table.string('email').notNullable()
    table.string('hash', 80).notNullable()
    table.timestamp('created_at', { precision: 6, useTz: true }).notNullable()
    table.timestamp('expires_at', { precision: 6, useTz: true }).nullable()
  })

  await db.connection().schema.createTable('password_reset_tokens', (table) => {
    table.increments()
    table.integer('tokenable_id').notNullable().unsigned()
    table.string('hash', 80).notNullable()
    table.timestamp('created_at', { precision: 6, useTz: true }).notNullable()
    table.timestamp('expires_at', { precision: 6, useTz: true }).nullable()
  })
}

/**
 * Freezes time in the moment
 */
export function freezeTime() {
  const test = getActiveTest()
  if (!test) {
    throw new Error('Cannot use "freezeTime" outside of a Japa test')
  }

  timekeeper.reset()

  const date = new Date()
  timekeeper.freeze(date)

  test.cleanup(() => {
    timekeeper.reset()
  })
}

/**
 * Travels time by seconds
 */
export function timeTravel(secondsToTravel: number) {
  const test = getActiveTest()
  if (!test) {
    throw new Error('Cannot use "timeTravel" outside of a Japa test')
  }

  timekeeper.reset()

  const date = new Date()
  date.setSeconds(date.getSeconds() + secondsToTravel)
  timekeeper.travel(date)

  test.cleanup(() => {
    timekeeper.reset()
  })
}

/**
 * Creates an encapsulated app with models and actions
 */
export function createApp() {
  class User extends compose(BaseModel, withEmailManagement()) {
    @column({ isPrimary: true })
    declare id: number

    @column()
    declare username: string

    @column()
    declare password: string
  }

  /**
   * The same logic will be used inside the starter kit
   */
  async function updateUserEmail(user: User, newEmail: string) {
    return await user.lockForUpdate(async (freshUser) => {
      if (!freshUser.hasEmailChanged(newEmail)) {
        await freshUser.save()
        return {
          type: 'SKIPPED',
        } as const
      }

      if (freshUser.hasEmailReverted(newEmail)) {
        freshUser.email = newEmail
        freshUser.unverifiedEmail = null
        await freshUser.save()
        await freshUser.clearEmailVerificationTokens()
        return {
          type: 'REVERTED',
        } as const
      }

      await freshUser.withEmail(newEmail).save()
      await freshUser.clearEmailVerificationTokens()
      const freshToken = await freshUser.createEmailVerificationToken(false)
      return {
        type: 'ISSUED_TOKEN',
        token: freshToken,
      } as const
    })
  }

  /**
   * Verifies the email and clears all tokens
   */
  async function verifyEmail(token: string) {
    const user = await User.verifyEmail(token)
    await user.clearEmailVerificationTokens()
  }

  return {
    models: {
      User,
    },
    actions: {
      updateUserEmail,
      verifyEmail,
    },
  }
}
