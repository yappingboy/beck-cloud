-- THIS TEST USER IS USED FOR TESTING PURPOSES ONLY ON LOCAL DEVELOPMENT DONT RUN THIS IN PRODUCTION OR MOM WILL BE SAD
INSERT INTO auth.users ( instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token) 
VALUES 
  ('00000000-0000-0000-0000-000000000000', uuid_generate_v4(), 'authenticated', 'authenticated', 'test@adamcad.com', crypt('password', gen_salt('bf')), current_timestamp, current_timestamp, current_timestamp, '{"provider":"email","providers":["email"]}', '{}', current_timestamp, current_timestamp, '', '', '', '');


-- test user email identity
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES 
  (uuid_generate_v4(), (SELECT id FROM auth.users WHERE email = 'test@adamcad.com'), format('{"sub":"%s","email":"%s"}', (SELECT id FROM auth.users WHERE email = 'test@adamcad.com')::text, 'test@adamcad.com')::jsonb, 'email', uuid_generate_v4(), current_timestamp, current_timestamp, current_timestamp);
