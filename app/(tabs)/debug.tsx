import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { colors, spacing, fontSize } from "../../lib/theme";
import { logger } from "../../lib/logger";

const levelColors = {
  info: "#4CAF50",
  warn: "#FF9800",
  error: "#F44336",
};

export default function DebugScreen() {
  const [logs, setLogs] = useState(logger.getLogs());

  useEffect(() => {
    const unsub = logger.subscribe(() => {
      setLogs(logger.getLogs());
    });
    return unsub;
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {logs.length} logs
        </Text>
        <TouchableOpacity style={styles.clearBtn} onPress={() => logger.clear()}>
          <Text style={styles.clearText}>Limpar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.logList}>
        {logs.length === 0 && (
          <Text style={styles.empty}>
            Nenhum log ainda. Inicie uma gravação para ver os logs.
          </Text>
        )}
        {logs.map((log, i) => (
          <View
            key={`${log.timestamp}-${i}`}
            style={[
              styles.logEntry,
              { borderLeftColor: levelColors[log.level] },
            ]}
          >
            <View style={styles.logHeader}>
              <Text
                style={[styles.logLevel, { color: levelColors[log.level] }]}
              >
                {log.level.toUpperCase()}
              </Text>
              <Text style={styles.logTime}>{log.timestamp}</Text>
            </View>
            <Text style={styles.logMessage} selectable>
              {log.message}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  title: {
    color: colors.light,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  clearBtn: {
    backgroundColor: colors.orange,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  clearText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: fontSize.sm,
  },
  logList: {
    flex: 1,
    padding: spacing.sm,
  },
  empty: {
    color: colors.gray,
    textAlign: "center",
    marginTop: spacing.xl,
    fontSize: fontSize.md,
  },
  logEntry: {
    backgroundColor: colors.card,
    borderRadius: 6,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderLeftWidth: 3,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  logLevel: {
    fontSize: fontSize.xs,
    fontWeight: "700",
  },
  logTime: {
    fontSize: fontSize.xs,
    color: colors.gray,
  },
  logMessage: {
    color: colors.light,
    fontSize: fontSize.xs,
    fontFamily: "monospace",
    lineHeight: 18,
  },
});
