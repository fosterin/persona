/*
 * @fosterin/persona
 *
 * (C) Foster Studio
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { inspect } from 'node:util'
import type { Secret } from '@adonisjs/core/helpers'
import stringHelpers from '@adonisjs/core/helpers/string'
import { RuntimeException } from '@adonisjs/core/exceptions'
import type { LucidModel } from '@adonisjs/lucid/types/model'

import { EmailVerificationToken } from './token.js'
import type { EmailTokenDbColumns, EmailTokensProviderOptions } from '../types.js'

/**
 * The EmailTokensProvider uses Lucid to persist verification
 * tokens inside a database table. Later these tokens can
 * be used for verification.
 */
export class EmailTokensProvider<TokenableModel extends LucidModel> {
  /**
   * Create tokens provider instance for a given Lucid model
   */
  static forModel<TokenableModel extends LucidModel>(
    model: EmailTokensProviderOptions<TokenableModel>['tokenableModel'],
    options?: Omit<EmailTokensProviderOptions<TokenableModel>, 'tokenableModel'>
  ) {
    return new EmailTokensProvider<TokenableModel>({
      tokenableModel: model,
      ...(options || {}),
    })
  }

  /**
   * The duration after which the email verification token will
   * expire
   */
  protected expiresIn: number

  /**
   * Database table to use for querying email verification tokens
   */
  protected table: string

  /**
   * The length for the token secret. A secret is a cryptographically
   * secure random string.
   */
  protected tokenSecretLength: number

  constructor(protected options: EmailTokensProviderOptions<TokenableModel>) {
    this.table = options.table || 'email_verification_tokens'
    this.tokenSecretLength = options.tokenSecretLength || 40
    this.expiresIn = stringHelpers.seconds.parse(options.expiresIn || '1 day')
  }

  /**
   * Check if value is an object
   */
  #isObject(value: unknown) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
  }

  /**
   * Ensure the provided user is an instance of the user model and
   * has a primary key
   */
  #ensureIsPersisted(user: InstanceType<TokenableModel>) {
    const model = this.options.tokenableModel
    if (user instanceof model === false) {
      throw new RuntimeException(
        `Invalid user object. It must be an instance of the "${model.name}" model`
      )
    }

    if (!user.$primaryKeyValue) {
      throw new RuntimeException(
        `Cannot use "${model.name}" model for managing email verification tokens. The value of column "${model.primaryKey}" is undefined or null`
      )
    }
  }

  /**
   * Maps a database row to a token instance
   */
  protected dbRowToEmailVerificationToken(dbRow: EmailTokenDbColumns): EmailVerificationToken {
    return new EmailVerificationToken({
      identifier: dbRow.id,
      tokenableId: dbRow.tokenable_id,
      email: dbRow.email,
      hash: dbRow.hash,
      createdAt:
        typeof dbRow.created_at === 'number' ? new Date(dbRow.created_at) : dbRow.created_at,
      expiresAt:
        typeof dbRow.expires_at === 'number' ? new Date(dbRow.expires_at) : dbRow.expires_at,
    })
  }

  /**
   * Returns a query client instance from the parent model
   */
  protected async getDb() {
    const model = this.options.tokenableModel
    return model.$adapter.query(model).client
  }

  /**
   * Create a token for a user
   */
  async create(
    user: InstanceType<TokenableModel>,
    email: string,
    options?: {
      expiresIn?: string | number
    }
  ) {
    this.#ensureIsPersisted(user)
    const queryClient = user.$trx || (await this.getDb())

    /**
     * Creating a transient token. Transient token abstracts
     * the logic of creating a random secure secret and its
     * hash
     */
    const transientToken = EmailVerificationToken.createTransientToken(
      user.$primaryKeyValue!,
      this.tokenSecretLength,
      options?.expiresIn || this.expiresIn
    )

    /**
     * Row to insert inside the database. We expect exactly these
     * columns to exist.
     */
    const dbRow: Omit<EmailTokenDbColumns, 'id'> = {
      tokenable_id: transientToken.userId,
      email: email,
      hash: transientToken.hash,
      created_at: new Date(),
      expires_at: transientToken.expiresAt,
    }

    /**
     * Insert data to the database.
     */
    const result = await queryClient.table(this.table).insert(dbRow).returning('id')
    const id = this.#isObject(result[0]) ? result[0].id : result[0]

    /**
     * Throw error when unable to find id in the return value of
     * the insert query
     */
    if (!id) {
      throw new RuntimeException(
        `Cannot save verification token. The result "${inspect(result)}" of insert query is unexpected`
      )
    }

    /**
     * Convert db row to an email verification token
     */
    return new EmailVerificationToken({
      identifier: id,
      tokenableId: dbRow.tokenable_id,
      email: dbRow.email,
      secret: transientToken.secret,
      hash: dbRow.hash,
      createdAt: dbRow.created_at,
      expiresAt: dbRow.expires_at,
    })
  }

  /**
   * Returns the timestamp for the last created token for a given
   * user
   */
  async lastCreatedAt(user: InstanceType<TokenableModel>): Promise<null | Date> {
    this.#ensureIsPersisted(user)

    const queryClient = await this.getDb()
    const dbRow = await queryClient
      .query<EmailTokenDbColumns>()
      .from(this.table)
      .where({ tokenable_id: user.$primaryKeyValue })
      .limit(1)
      .orderBy('created_at', 'desc')
      .first()

    if (!dbRow) {
      return null
    }

    return typeof dbRow.created_at === 'number' ? new Date(dbRow.created_at) : dbRow.created_at
  }

  /**
   * Find a token for a user by the token id
   */
  async find(user: InstanceType<TokenableModel>, identifier: string | number | BigInt) {
    this.#ensureIsPersisted(user)

    const queryClient = await this.getDb()
    const dbRow = await queryClient
      .query<EmailTokenDbColumns>()
      .from(this.table)
      .where({ id: identifier, tokenable_id: user.$primaryKeyValue })
      .limit(1)
      .first()

    if (!dbRow) {
      return null
    }

    return this.dbRowToEmailVerificationToken(dbRow)
  }

  /**
   * Delete a token by its id
   */
  async delete(
    user: InstanceType<TokenableModel>,
    identifier: string | number | BigInt
  ): Promise<number> {
    this.#ensureIsPersisted(user)

    const queryClient = user.$trx || (await this.getDb())
    const affectedRows = await queryClient
      .query<number>()
      .from(this.table)
      .where({ id: identifier, tokenable_id: user.$primaryKeyValue })
      .del()
      .exec()

    return affectedRows as unknown as number
  }

  /**
   * Delete all tokens for a given user
   */
  async deleteAll(user: InstanceType<TokenableModel>): Promise<number> {
    this.#ensureIsPersisted(user)

    const queryClient = user.$trx || (await this.getDb())
    const affectedRows = await queryClient
      .query<number>()
      .from(this.table)
      .where({ tokenable_id: user.$primaryKeyValue })
      .del()
      .exec()

    return affectedRows as unknown as number
  }

  /**
   * Returns all the tokens for a given user
   */
  async all(user: InstanceType<TokenableModel>) {
    this.#ensureIsPersisted(user)

    const queryClient = await this.getDb()
    const dbRows = await queryClient
      .query<EmailTokenDbColumns>()
      .from(this.table)
      .where({ tokenable_id: user.$primaryKeyValue })
      .orderBy('created_at', 'desc')
      .exec()

    return dbRows.map((dbRow) => {
      return this.dbRowToEmailVerificationToken(dbRow)
    })
  }

  /**
   * Verifies a publicly shared email verification token and returns an
   * EmailVerificationToken for it.
   *
   * Returns null when unable to verify the token or find it
   * inside the storage
   */
  async verify(tokenValue: Secret<string>) {
    const decodedToken = EmailVerificationToken.decode(tokenValue.release())
    if (!decodedToken) {
      return null
    }

    const db = await this.getDb()
    const dbRow = await db
      .query<EmailTokenDbColumns>()
      .from(this.table)
      .where({ id: decodedToken.identifier })
      .limit(1)
      .first()

    if (!dbRow) {
      return null
    }

    /**
     * Convert to email verification token instance
     */
    const token = this.dbRowToEmailVerificationToken(dbRow)

    /**
     * Ensure the token secret matches the token hash
     */
    if (!token.verify(decodedToken.secret) || token.isExpired()) {
      return null
    }

    return token
  }
}
