import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  user: User | null;
  isAdmin: boolean;
  isVeilleur: boolean;
  /** admin ou veilleur : accès à la console */
  isStaff: boolean;
  ready: boolean;
  loginOpen: boolean;
  setLoginOpen: (v: boolean) => void;
  loginMode: "signin" | "signup";
  openLogin: (mode?: "signin" | "signup") => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVeilleur, setIsVeilleur] = useState(false);
  const [ready, setReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMode, setLoginMode] = useState<"signin" | "signup">("signin");
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    const check = async (u: User | null) => {
      setUser(u);
      if (u) {
        const { data } = await supabase.rpc("has_role", { _user_id: u.id, _role: "admin" });
        setIsAdmin(!!data);
        // Rôle ajouté hors des types générés (D-WEB-10)
        const { data: v } = await supabase.rpc("has_role", { _user_id: u.id, _role: "veilleur" as "admin" });
        setIsVeilleur(!!v);
      } else {
        setIsAdmin(false);
        setIsVeilleur(false);
      }
      setReady(true);
    };
    supabase.auth.getUser().then(({ data }) => check(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      check(session?.user ?? null);
      if (event === "SIGNED_IN") setLoginOpen(false);
      router.invalidate();
      if (event === "SIGNED_OUT") qc.clear();
      else qc.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, qc]);

  return (
    <Ctx.Provider
      value={{
        user,
        isAdmin,
        isVeilleur,
        isStaff: isAdmin || isVeilleur,
        ready,
        loginOpen,
        setLoginOpen,
        loginMode,
        openLogin: (m = "signin") => {
          setLoginMode(m);
          setLoginOpen(true);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
