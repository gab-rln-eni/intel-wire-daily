export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      actions_sources: {
        Row: {
          action: string
          auteur: string | null
          auteur_email: string | null
          categorie: string | null
          cree_le: string
          detail: string | null
          id: string
          motif: string
          nom: string
          priorite: string | null
          pris_le: string | null
          role: string | null
          statut: string
          traite_le: string | null
          url: string | null
          valide_par: string | null
        }
        Insert: {
          action: string
          auteur?: string | null
          auteur_email?: string | null
          categorie?: string | null
          cree_le?: string
          detail?: string | null
          id?: string
          motif: string
          nom: string
          priorite?: string | null
          pris_le?: string | null
          role?: string | null
          statut?: string
          traite_le?: string | null
          url?: string | null
          valide_par?: string | null
        }
        Update: {
          action?: string
          auteur?: string | null
          auteur_email?: string | null
          categorie?: string | null
          cree_le?: string
          detail?: string | null
          id?: string
          motif?: string
          nom?: string
          priorite?: string | null
          pris_le?: string | null
          role?: string | null
          statut?: string
          traite_le?: string | null
          url?: string | null
          valide_par?: string | null
        }
        Relationships: []
      }
      admin_journal: {
        Row: {
          action: string
          auteur: string | null
          auteur_email: string | null
          cible: string | null
          cree_le: string
          detail: string | null
          id: string
          resultat: string
          role: string | null
        }
        Insert: {
          action: string
          auteur?: string | null
          auteur_email?: string | null
          cible?: string | null
          cree_le?: string
          detail?: string | null
          id?: string
          resultat?: string
          role?: string | null
        }
        Update: {
          action?: string
          auteur?: string | null
          auteur_email?: string | null
          cible?: string | null
          cree_le?: string
          detail?: string | null
          id?: string
          resultat?: string
          role?: string | null
        }
        Relationships: []
      }
      chaine_etat: {
        Row: {
          dernier_appel: string | null
          id: number
        }
        Insert: {
          dernier_appel?: string | null
          id?: number
        }
        Update: {
          dernier_appel?: string | null
          id?: number
        }
        Relationships: []
      }
      demandes: {
        Row: {
          created_at: string
          demandeur: string | null
          detail: string | null
          id: string
          pris_le: string | null
          statut: string
          sujets_avant: number | null
          termine_le: string | null
        }
        Insert: {
          created_at?: string
          demandeur?: string | null
          detail?: string | null
          id?: string
          pris_le?: string | null
          statut?: string
          sujets_avant?: number | null
          termine_le?: string | null
        }
        Update: {
          created_at?: string
          demandeur?: string | null
          detail?: string | null
          id?: string
          pris_le?: string | null
          statut?: string
          sujets_avant?: number | null
          termine_le?: string | null
        }
        Relationships: []
      }
      favoris: {
        Row: {
          date_veille: string | null
          id: string
          lien: string
          lien_etat: string
          resume: string | null
          rubrique: string | null
          sauve_le: string
          source: string | null
          titre: string
          user_id: string
          verifie_le: string | null
        }
        Insert: {
          date_veille?: string | null
          id?: string
          lien: string
          lien_etat?: string
          resume?: string | null
          rubrique?: string | null
          sauve_le?: string
          source?: string | null
          titre: string
          user_id: string
          verifie_le?: string | null
        }
        Update: {
          date_veille?: string | null
          id?: string
          lien?: string
          lien_etat?: string
          resume?: string | null
          rubrique?: string | null
          sauve_le?: string
          source?: string | null
          titre?: string
          user_id?: string
          verifie_le?: string | null
        }
        Relationships: []
      }
      lectures: {
        Row: {
          lien: string
          lu_le: string
          user_id: string
        }
        Insert: {
          lien: string
          lu_le?: string
          user_id: string
        }
        Update: {
          lien?: string
          lu_le?: string
          user_id?: string
        }
        Relationships: []
      }
      nettoyages_salons: {
        Row: {
          auteur_email: string | null
          cree_le: string
          detail: string | null
          id: string
          mode: string
          portee: string
          pris_le: string | null
          salon: string
          statut: string
          supprimes: number
          termine_le: string | null
        }
        Insert: {
          auteur_email?: string | null
          cree_le?: string
          detail?: string | null
          id?: string
          mode: string
          portee: string
          pris_le?: string | null
          salon: string
          statut?: string
          supprimes?: number
          termine_le?: string | null
        }
        Update: {
          auteur_email?: string | null
          cree_le?: string
          detail?: string | null
          id?: string
          mode?: string
          portee?: string
          pris_le?: string | null
          salon?: string
          statut?: string
          supprimes?: number
          termine_le?: string | null
        }
        Relationships: []
      }
      parametres: {
        Row: {
          cle: string
          maj_le: string
          maj_par: string | null
          valeur: Json
        }
        Insert: {
          cle: string
          maj_le?: string
          maj_par?: string | null
          valeur: Json
        }
        Update: {
          cle?: string
          maj_le?: string
          maj_par?: string | null
          valeur?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          canal: string
          consentement_le: string | null
          created_at: string
          discord_webhook_url: string | null
          email: string | null
          id: string
          rubriques: string[]
        }
        Insert: {
          canal?: string
          consentement_le?: string | null
          created_at?: string
          discord_webhook_url?: string | null
          email?: string | null
          id: string
          rubriques?: string[]
        }
        Update: {
          canal?: string
          consentement_le?: string | null
          created_at?: string
          discord_webhook_url?: string | null
          email?: string | null
          id?: string
          rubriques?: string[]
        }
        Relationships: []
      }
      sources_miroir: {
        Row: {
          active: boolean
          categorie: string | null
          jours_echec: number | null
          maj_le: string
          nb_articles: number | null
          nom: string
          priorite: number | null
          sante_le: string | null
          statut_sante: string | null
          url: string | null
        }
        Insert: {
          active?: boolean
          categorie?: string | null
          jours_echec?: number | null
          maj_le?: string
          nb_articles?: number | null
          nom: string
          priorite?: number | null
          sante_le?: string | null
          statut_sante?: string | null
          url?: string | null
        }
        Update: {
          active?: boolean
          categorie?: string | null
          jours_echec?: number | null
          maj_le?: string
          nb_articles?: number | null
          nom?: string
          priorite?: number | null
          sante_le?: string | null
          statut_sante?: string | null
          url?: string | null
        }
        Relationships: []
      }
      sujets: {
        Row: {
          extrait: string
          id: string
          lien: string
          ordre: number
          ordre_rubrique: number
          publie_le: string | null
          redige: boolean
          resume: string
          rubrique: string
          source: string
          synthese_id: string
          titre: string
        }
        Insert: {
          extrait?: string
          id?: string
          lien: string
          ordre?: number
          ordre_rubrique?: number
          publie_le?: string | null
          redige?: boolean
          resume?: string
          rubrique: string
          source?: string
          synthese_id: string
          titre: string
        }
        Update: {
          extrait?: string
          id?: string
          lien?: string
          ordre?: number
          ordre_rubrique?: number
          publie_le?: string | null
          redige?: boolean
          resume?: string
          rubrique?: string
          source?: string
          synthese_id?: string
          titre?: string
        }
        Relationships: [
          {
            foreignKeyName: "sujets_synthese_id_fkey"
            columns: ["synthese_id"]
            isOneToOne: false
            referencedRelation: "syntheses"
            referencedColumns: ["id"]
          },
        ]
      }
      syntheses: {
        Row: {
          created_at: string
          date_veille: string
          degrade: boolean
          envoye_le: string | null
          exemple: boolean
          id: string
          nb_articles: number | null
          nb_sources: number | null
          nb_sources_echec: number | null
          nb_sujets: number | null
          statut: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_veille: string
          degrade?: boolean
          envoye_le?: string | null
          exemple?: boolean
          id?: string
          nb_articles?: number | null
          nb_sources?: number | null
          nb_sources_echec?: number | null
          nb_sujets?: number | null
          statut: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_veille?: string
          degrade?: boolean
          envoye_le?: string | null
          exemple?: boolean
          id?: string
          nb_articles?: number | null
          nb_sources?: number | null
          nb_sources_echec?: number | null
          nb_sujets?: number | null
          statut?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apercu_public: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lancer_demande: { Args: { p_user: string }; Returns: Json }
      maintenance_executer: {
        Args: { p_auteur: string; p_email: string; p_force: boolean }
        Returns: Json
      }
      prendre_action_source: { Args: never; Returns: Json }
      prendre_demande: { Args: never; Returns: Json }
      prendre_nettoyage: { Args: never; Returns: Json }
      publier_sources: { Args: { p: Json }; Returns: Json }
      publier_synthese: { Args: { p: Json }; Returns: Json }
      purger_journal: {
        Args: { p_auteur: string; p_email: string; p_jours: number }
        Returns: Json
      }
      terminer_action_source: {
        Args: { p_detail: string; p_id: string; p_statut: string }
        Returns: Json
      }
      terminer_demande: {
        Args: { p_erreur: string; p_id: string }
        Returns: Json
      }
      terminer_nettoyage: {
        Args: {
          p_detail: string
          p_id: string
          p_ok: boolean
          p_reste: boolean
          p_supprimes: number
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user" | "veilleur"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "veilleur"],
    },
  },
} as const
