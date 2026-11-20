import React from "react";
import { SafeAreaView, ScrollView, Text, View, Platform } from "react-native";
import { configured } from "./src/auth";
import { useWorkspace } from "./src/workspace";
import { styles, Button, Card } from "./src/ui";
import { Inbox, NetworkAdmin, PendingWork, Profile, SignIn, TaskDetail, TaskList, WarehouseListings, WarehouseSpace } from "./src/screens";

export default function App() {
  const {
    session, profile, tasks, selected, setSelected, tab, setTab, error, connected,
    space, reservations, inbox, warehouses, refresh, open, logout,
  } = useWorkspace();
  return (
    <SafeAreaView style={[styles.page, Platform.OS === "web" && { width: "100%", maxWidth: 880, alignSelf: "stretch", marginHorizontal: "auto" }]}>
      <View style={{ padding: 18, paddingBottom: 8 }}>
        <Text style={styles.title}>Freight Partners</Text>
        <Text style={styles.muted}>
          {connected ? "Connected" : "Offline · saved work"}
        </Text>
        {Platform.OS === "web" && <Text style={styles.muted}>Partner web app · Inbox updates while open. Location sharing requires an active page.</Text>}
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {error && <Text style={styles.error}>{error}</Text>}
        {!configured ? (
          <Card>
            <Text style={styles.error}>
              The app connection is unavailable. Please contact the service owner.
            </Text>
          </Card>
        ) : !session ? (
          <SignIn />
        ) : (
          <>
            <PendingWork reload={refresh} />
            {!profile || tab === "Profile" ? (
              <Profile
                key={profile?.id || "new"}
                profile={profile}
                reload={refresh}
                logout={logout}
              />
            ) : (
              <>
                {tab === "Tasks" &&
                  (selected ? (
                    <TaskDetail
                      initial={selected}
                      back={() => setSelected(null)}
                      changed={refresh}
                    />
                  ) : (
                    <TaskList tasks={tasks} select={setSelected} />
                  ))}
                {tab === "Space" && (
                  <WarehouseSpace
                    enquiries={space}
                    reservations={reservations}
                    reload={refresh}
                  />
                )}
                {tab === "Warehouses" && (
                  <WarehouseListings listings={warehouses} reload={refresh} />
                )}
                {tab === "Inbox" && (
                  <Inbox items={inbox} reload={refresh} open={open} />
                )}
                {tab === "Admin" && <NetworkAdmin />}
              </>
            )}
          </>
        )}
      </ScrollView>
      {session && profile && (
        <View
          style={[
            styles.row,
            {
              padding: 10,
              backgroundColor: "white",
              borderTopWidth: 1,
              borderColor: "#e8e4f3",
            },
          ]}
        >
          {[
            "Tasks",
            ...(profile.capabilities?.includes("warehouse_owner")
              ? ["Space", "Warehouses"]
              : []),
            "Inbox",
            "Profile",
            ...(profile.is_network_admin ? ["Admin"] : []),
          ].map((name) => (
            <Button
              key={name}
              secondary={name !== tab}
              onPress={() => {
                setTab(name);
                setSelected(null);
              }}
            >
              {name}
            </Button>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}
