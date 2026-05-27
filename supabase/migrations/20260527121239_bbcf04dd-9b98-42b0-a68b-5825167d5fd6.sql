
-- PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  nationality TEXT,
  avatar_url TEXT,
  group_type TEXT DEFAULT 'couple',
  pace TEXT DEFAULT 'moderate',
  budget TEXT DEFAULT 'mid',
  cuisine TEXT[] DEFAULT ARRAY['Spicy','Street Food']::TEXT[],
  interests TEXT[] DEFAULT ARRAY['historical','food','nightlife']::TEXT[],
  dietary_restrictions TEXT[] DEFAULT ARRAY[]::TEXT[],
  has_international_card BOOLEAN DEFAULT true,
  mobility TEXT DEFAULT 'normal',
  onboarded BOOLEAN DEFAULT false,
  extra JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "users delete own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- TRIPS (one active per user, but allow multiple via archived flag)
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  cities JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_city_id TEXT,
  itinerary JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own trips" ON public.trips FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own trips" ON public.trips FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own trips" ON public.trips FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own trips" ON public.trips FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_trips_user ON public.trips(user_id);

-- SAVED POIS
CREATE TABLE public.saved_pois (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  poi_id TEXT NOT NULL,
  name TEXT,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, poi_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_pois TO authenticated;
GRANT ALL ON public.saved_pois TO service_role;
ALTER TABLE public.saved_pois ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own saved" ON public.saved_pois FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own saved" ON public.saved_pois FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own saved" ON public.saved_pois FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- DIGITAL TOOLS STATUS
CREATE TABLE public.digital_tools (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tool)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digital_tools TO authenticated;
GRANT ALL ON public.digital_tools TO service_role;
ALTER TABLE public.digital_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own tools" ON public.digital_tools FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users upsert own tools" ON public.digital_tools FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own tools" ON public.digital_tools FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own tools" ON public.digital_tools FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ACTIVITY LOG
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own activity" ON public.activity_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own activity" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own activity" ON public.activity_log FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_activity_user_created ON public.activity_log(user_id, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_trips_updated BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tools_updated BEFORE UPDATE ON public.digital_tools
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AUTO-CREATE PROFILE on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
