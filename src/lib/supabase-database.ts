export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserAppStateRow = {
  user_id: string;
  data: Json;
  revision: number;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      user_app_state: {
        Row: UserAppStateRow;
        Insert: {
          user_id: string;
          data?: Json;
          revision?: number;
          updated_at?: string;
        };
        Update: {
          data?: Json;
          revision?: number;
          updated_at?: string;
        };
        // auth.users lives outside public, so generated Supabase types expose no
        // PostgREST relationship for this foreign key.
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
