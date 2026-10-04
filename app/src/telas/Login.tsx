import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { cores } from '../tema';

type Modo = 'entrar' | 'cadastrar';

// Traduz as mensagens mais comuns do Supabase Auth.
function traduzirErro(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(msg)) return 'Este e-mail já tem cadastro. Use "Entrar".';
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail pelo link que enviamos.';
  if (/password should be at least/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/invalid.*email|email.*invalid/i.test(msg)) return 'E-mail inválido.';
  if (/network request failed|fetch/i.test(msg)) return 'Sem conexão com o servidor.';
  return msg;
}

export function Login() {
  const [modo, setModo] = useState<Modo>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();

  const cadastrando = modo === 'cadastrar';
  const podeEnviar =
    email.includes('@') && senha.length >= 6 && (!cadastrando || nome.trim().length >= 2) && !enviando;

  async function enviar() {
    setErro(undefined);
    setAviso(undefined);
    setEnviando(true);
    try {
      if (cadastrando) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { data: { nome: nome.trim() } },
        });
        if (error) throw error;
        // Se o projeto exige confirmação de e-mail, não vem sessão ainda.
        if (!data.session) {
          setAviso('Cadastro feito! Abra o link que enviamos para o seu e-mail e depois entre.');
          setModo('entrar');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw error;
      }
      // Com sessão criada, o App troca para o scanner sozinho (onAuthStateChange).
    } catch (e) {
      setErro(traduzirErro(e instanceof Error ? e.message : String(e)));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.tela}>
      <KeyboardAvoidingView style={styles.conteudo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.marca}>MaisBarato</Text>
        <Text style={styles.slogan}>Compare preços com quem faz compras perto de você.</Text>

        <View style={styles.abas}>
          {(['entrar', 'cadastrar'] as const).map((m) => (
            <Pressable key={m} style={[styles.aba, modo === m && styles.abaAtiva]} onPress={() => setModo(m)}>
              <Text style={[styles.abaTexto, modo === m && styles.abaTextoAtivo]}>
                {m === 'entrar' ? 'Entrar' : 'Criar conta'}
              </Text>
            </Pressable>
          ))}
        </View>

        {cadastrando && (
          <TextInput
            style={styles.input}
            placeholder="Seu nome"
            autoComplete="name"
            value={nome}
            onChangeText={setNome}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="E-mail"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Senha (mín. 6 caracteres)"
          secureTextEntry
          autoComplete={cadastrando ? 'new-password' : 'current-password'}
          value={senha}
          onChangeText={setSenha}
          onSubmitEditing={() => podeEnviar && enviar()}
        />

        {erro && <Text style={styles.erro}>{erro}</Text>}
        {aviso && <Text style={styles.aviso}>{aviso}</Text>}

        <Pressable style={[styles.botao, !podeEnviar && styles.botaoDesativado]} disabled={!podeEnviar} onPress={enviar}>
          {enviando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botaoTexto}>{cadastrando ? 'Criar conta' : 'Entrar'}</Text>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { flex: 1, justifyContent: 'center', padding: 24 },
  marca: { fontSize: 34, fontWeight: '800', color: cores.verde, textAlign: 'center' },
  slogan: { fontSize: 15, color: cores.cinza, textAlign: 'center', marginTop: 4, marginBottom: 28 },
  abas: { flexDirection: 'row', backgroundColor: cores.cinzaClaro, borderRadius: 10, padding: 4, marginBottom: 16 },
  aba: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  abaAtiva: { backgroundColor: '#fff' },
  abaTexto: { fontSize: 15, color: cores.cinza, fontWeight: '600' },
  abaTextoAtivo: { color: cores.texto },
  input: {
    borderWidth: 1,
    borderColor: '#d0d5da',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  erro: { color: '#c62828', marginBottom: 10, fontSize: 14 },
  aviso: { color: cores.verde, marginBottom: 10, fontSize: 14 },
  botao: { backgroundColor: cores.verde, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  botaoDesativado: { opacity: 0.4 },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
