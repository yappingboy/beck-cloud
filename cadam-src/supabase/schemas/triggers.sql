CREATE OR REPLACE FUNCTION "public"."update_conversation_leaf"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  update conversations set 
    current_message_leaf_id = new.id,
    updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

CREATE OR REPLACE TRIGGER "update_leaf_trigger" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_leaf"();

-- Previews updated_at trigger
-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at for previews
CREATE OR REPLACE TRIGGER update_previews_updated_at 
    BEFORE UPDATE ON "public"."previews" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Profile creation trigger for new users
-- Create function to handle new user sign ups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    )
  );
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create profile on user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
