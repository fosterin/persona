# AdonisJS package starter kit

## Email management scanerios

### Scanerio 1

- **User A** updates their email to "foo@bar.com". This makes it way into the `unverified_email` column.
- **User B** creates an account with "foo@bar.com". This makes it way into both `email` and `unverified_email` columns.
- Now **User B** has exclusive control over "foo@bar.com". **User A**, even if they want cannot verify this email and link it to their account. This is because, one email can become primary email on one user account only. Right now (even if unverified), this email is linked as primary email with **User B** account.
- So, there should be a CRON job to delete new accounts that has never verified emails.
- Alternatively, you can setup the `VerifyEmail` logic to delete unverified accounts when someone else is able to verify the email address linked as primary email with an unverified account.

### Scanerio 2
