import { useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { colors, spacing, fontSize } from "../../lib/theme";
import { getAllMeetings } from "../../lib/database";
import type { Meeting } from "../../lib/types";

export default function HistoryScreen() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadMeetings();
    }, [])
  );

  async function loadMeetings() {
    setMeetings(await getAllMeetings());
  }

  function getStatusLabel(status: Meeting["status"]) {
    switch (status) {
      case "recording":
        return { text: "Gravando", color: colors.red };
      case "processing":
        return { text: "Processando", color: colors.orange };
      case "done":
        return { text: "Pronta", color: colors.green };
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={meetings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>Nenhuma reunião</Text>
            <Text style={styles.emptySubtext}>
              Suas atas aparecerão aqui
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const status = getStatusLabel(item.status);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                if (item.status === "done") {
                  router.push(`/meeting/result/${item.id}`);
                } else if (item.status === "recording") {
                  router.push(`/meeting/${item.id}`);
                }
              }}
            >
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>
                  {item.title || "Reunião"}
                </Text>
                <Text style={styles.cardDate}>{item.date}</Text>
              </View>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: status.color + "20" },
                ]}
              >
                <Text style={[styles.badgeText, { color: status.color }]}>
                  {status.text}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  list: {
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.light,
  },
  cardDate: {
    fontSize: fontSize.sm,
    color: colors.gray,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
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
});
