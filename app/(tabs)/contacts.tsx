import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { colors, spacing, fontSize } from "../../lib/theme";
import {
  getAllContacts,
  createContact,
  updateContact,
  deleteContact,
} from "../../lib/database";
import type { Contact } from "../../lib/types";

export default function ContactsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadContacts();
    }, [])
  );

  async function loadContacts() {
    setContacts(await getAllContacts());
  }

  function resetForm() {
    setName("");
    setEmail("");
    setPhone("");
    setEditingId(null);
    setShowForm(false);
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Nome obrigatório", "Informe o nome do participante.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      Alert.alert("Contato obrigatório", "Informe email ou telefone.");
      return;
    }

    if (editingId) {
      await updateContact(editingId, name.trim(), email.trim(), phone.trim());
    } else {
      await createContact(name.trim(), email.trim(), phone.trim());
    }
    resetForm();
    await loadContacts();
  }

  function handleEdit(contact: Contact) {
    setEditingId(contact.id);
    setName(contact.name);
    setEmail(contact.email);
    setPhone(contact.phone);
    setShowForm(true);
  }

  function handleDelete(contact: Contact) {
    Alert.alert("Excluir contato", `Remover ${contact.name}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          await deleteContact(contact.id);
          await loadContacts();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {showForm ? (
        <View style={styles.form}>
          <Text style={styles.formTitle}>
            {editingId ? "Editar Contato" : "Novo Contato"}
          </Text>

          <Text style={styles.label}>Nome</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nome completo"
            placeholderTextColor={colors.gray}
            autoFocus
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="email@exemplo.com"
            placeholderTextColor={colors.gray}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Telefone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+55 11 99999-9999"
            placeholderTextColor={colors.gray}
            keyboardType="phone-pad"
          />

          <View style={styles.formButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <FlatList
            data={contacts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyText}>Nenhum contato</Text>
                <Text style={styles.emptySubtext}>
                  Cadastre participantes para suas reuniões
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => handleEdit(item)}
                onLongPress={() => handleDelete(item)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardDetail}>
                    {item.email || item.phone}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />

          <TouchableOpacity
            style={styles.fab}
            onPress={() => setShowForm(true)}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.orange + "25",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.orange,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.light,
  },
  cardDetail: {
    fontSize: fontSize.sm,
    color: colors.gray,
    marginTop: 2,
  },
  empty: {
    alignItems: "center",
    marginTop: spacing.xxl * 2,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.light,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.gray,
    marginTop: spacing.xs,
  },
  fab: {
    position: "absolute",
    bottom: spacing.xl,
    right: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 32,
    color: colors.white,
    fontWeight: "300",
    marginTop: -2,
  },
  form: {
    padding: spacing.lg,
  },
  formTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.light,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.grayLight,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.light,
  },
  formButtons: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  cancelBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cancelText: {
    fontSize: fontSize.md,
    color: colors.gray,
    fontWeight: "600",
  },
  saveBtn: {
    flex: 2,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: colors.orange,
  },
  saveText: {
    fontSize: fontSize.md,
    color: colors.white,
    fontWeight: "700",
  },
});
