import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "../../lib/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.dark,
          borderTopColor: colors.cardBorder,
        },
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.gray,
        headerStyle: { backgroundColor: colors.dark },
        headerTintColor: colors.light,
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Reuniões",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22, color }}>🎙</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: "Contatos",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22, color }}>👥</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Histórico",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22, color }}>📋</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="debug"
        options={{
          title: "Debug",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22, color }}>🔧</Text>
          ),
        }}
      />
    </Tabs>
  );
}
