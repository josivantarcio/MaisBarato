import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './src/lib/supabase';
import { cores } from './src/tema';
import { Login } from './src/telas/Login';
import { Scanner } from './src/telas/Scanner';

export default function App() {
  // undefined = ainda verificando se existe sessão salva no aparelho
  const [sessao, setSessao] = useState<Session | null>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => setSessao(novaSessao));
    return () => data.subscription.unsubscribe();
  }, []);

  const nome =
    (sessao?.user.user_metadata?.nome as string | undefined)?.split(' ')[0] ??
    sessao?.user.email?.split('@')[0] ??
    '';

  return (
    <SafeAreaProvider>
      {sessao === undefined ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={cores.verde} />
        </View>
      ) : sessao ? (
        <Scanner nomeUsuario={nome} />
      ) : (
        <Login />
      )}
    </SafeAreaProvider>
  );
}
