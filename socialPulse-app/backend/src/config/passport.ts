import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { pool } from './database';
import { v4 as uuidv4 } from 'uuid';

export const configurePassport = () => {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL!,
        passReqToCallback: true
    }, async (req, accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0].value;
            if (!email) {
                return done(new Error('No email found in Google profile'));
            }

            // Check if user exists
            const { rows: users } = await pool.query(
                'SELECT * FROM users WHERE email = $1',
                [email]
            );

            let user = users[0];

            if (!user) {
                // Create new user
                const { rows: newUsers } = await pool.query(
                    `INSERT INTO users (email, full_name, password_hash, ai_credits)
                     VALUES ($1, $2, $3, 10)
                     RETURNING *`,
                    [
                        email,
                        profile.displayName,
                        null, // No password for Google users
                    ]
                );
                user = newUsers[0];

                // Create initial workspace
                const workspaceId = uuidv4(); // id is likely uuid in workspaces too
                await pool.query(
                    'INSERT INTO workspaces (id, name, owner_id) VALUES ($1, $2, $3)',
                    [workspaceId, `${profile.displayName}'s Workspace`, user.id]
                );
            }

            return done(null, user);
        } catch (err) {
            return done(err as Error);
        }
    }));
};
