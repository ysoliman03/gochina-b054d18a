ALTER TABLE public.profiles
  ALTER COLUMN cuisine SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN interests SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN dietary_restrictions SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN onboarded SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    name,
    avatar_url,
    cuisine,
    interests,
    dietary_restrictions,
    onboarded
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;