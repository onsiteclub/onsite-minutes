import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
} from "react-native";
import { colors, spacing, fontSize } from "../lib/theme";
import type { Contact } from "../lib/types";

interface Props {
  contacts: Contact[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ParticipantSelector({
  contacts,
  selectedIds,
  onToggle,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Participantes</Text>
          <Text style={styles.subtitle}>
            Selecione quem está na reunião
          </Text>

          <FlatList
            data={contacts}
            keyExtractor={(item) => item.id}
            style={styles.list}
            renderItem={({ item }) => {
              const selected = selectedIds.includes(item.id);
              return (
                <TouchableOpacity
                  style={[styles.item, selected && styles.itemSelected]}
                  onPress={() => onToggle(item.id)}
                >
                  <View style={styles.checkbox}>
                    {selected && <View style={styles.checkboxInner} />}
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemEmail}>{item.email || item.phone}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
              <Text style={styles.confirmText}>
                Iniciar ({selectedIds.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.darkLighter,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    maxHeight: "80%",
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.light,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.gray,
    marginBottom: spacing.lg,
  },
  list: {
    maxHeight: 300,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  itemSelected: {
    borderColor: colors.orange,
    backgroundColor: colors.orange + "15",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gray,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  checkboxInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.orange,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.light,
  },
  itemEmail: {
    fontSize: fontSize.sm,
    color: colors.gray,
    marginTop: 2,
  },
  buttons: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
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
  confirmBtn: {
    flex: 2,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: colors.orange,
  },
  confirmText: {
    fontSize: fontSize.md,
    color: colors.white,
    fontWeight: "700",
  },
});
