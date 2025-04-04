import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Timer "mo:base/Timer";
import BTree "mo:stableheapbtreemap/BTree";

import SubscriptionManager "../Subscription/SubscriptionManager";
import CanisterIDs "../Types/CanisterIDs";

actor class DataStorageShard() {
    // Type for storing chunks temporarily
    private type ChunkData = {
        chunks : Buffer.Buffer<Blob>;
        totalChunks : Nat;
    };

    private stable let MAX_TOTAL_CHUNK = 25;
    private let subscriptionManager : SubscriptionManager.SubscriptionManager = actor (CanisterIDs.subscriptionManagerCanisterID);

    private stable var dataStoreAccess : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null);
    private stable var dataReadPermittedPrincipals : BTree.BTree<Text, BTree.BTree<Principal, Time.Time>> = BTree.init<Text, BTree.BTree<Principal, Time.Time>>(null);

    // Main storage map for completed data
    private stable var dataStore : BTree.BTree<Text, Blob> = BTree.init<Text, Blob>(null);
    // Temporary storage for chunks being uploaded
    private let chunksInProgress : BTree.BTree<Text, ChunkData> = BTree.init<Text, ChunkData>(null);
    //Permitted Principal List
    private stable var permittedPrincipals : [Principal] = [Principal.fromText(CanisterIDs.dataAssetCanisterID)];

    // Define constant for one day in nanoseconds
    private let ONE_DAY_NANOS : Nat = 86_400_000_000_000;

    public shared ({ caller }) func grantAccess(principal : Principal, id : Text) : async Result.Result<Text, Text> {
        if (not isPermitted(caller)) {
            return #err("Not permitted");
        };

        ignore BTree.insert(dataStoreAccess, Text.compare, id, principal);

        return #ok("Access granted");
    };

    public shared ({ caller }) func revokeAccess(id : Text) : async Result.Result<Text, Text> {
        if (not isPermitted(caller)) {
            return #err("Not permitted");
        };
        ignore BTree.delete(dataStoreAccess, Text.compare, id);

        return #ok("Access revoked");
    };

    // Initialize chunk upload
    public shared ({ caller }) func startChunkUpload(id : Text, totalChunks : Nat) : async Result.Result<Text, Text> {
        switch (BTree.get(dataStoreAccess, Text.compare, id)) {
            case (?value) {
                if (value != caller) {
                    return #err("Not permitted");
                };
            };
            case (null) {
                return #err("Not permitted");
            };
        };

        if (totalChunks > MAX_TOTAL_CHUNK) {
            return #err("Total chunks exceed maximum limit");
        };

        switch (BTree.get(dataStore, Text.compare, id)) {
            case (?_existingData) {
                return #err("Data already exists");
            };
            case null {
                let totalSize = 1_900_000 * totalChunks;
                switch (await subscriptionManager.checkDataStorageUsedMap(caller, totalSize)) {
                    case (#ok(_)) {
                        switch (BTree.get(chunksInProgress, Text.compare, id)) {
                            case (?_) {
                                return #err("Upload already in progress for this ID");
                            };
                            case null {
                                let chunkBuffer = Buffer.Buffer<Blob>(totalChunks);
                                ignore BTree.insert(
                                    chunksInProgress,
                                    Text.compare,
                                    id,
                                    {
                                        chunks = chunkBuffer;
                                        totalChunks = totalChunks;
                                    },
                                );
                                return #ok("Upload started");
                            };
                        };
                    };
                    case (#err(err)) {
                        return #err(err);
                    };
                };
            };
        };
    };

    // Upload individual chunk
    public shared ({ caller }) func uploadChunk(id : Text, chunkIndex : Nat, chunk : Blob) : async Result.Result<Text, Text> {
        switch (BTree.get(dataStoreAccess, Text.compare, id)) {
            case (?value) {
                if (value != caller) {
                    return #err("Not permitted");
                };
            };
            case (null) {
                return #err("Not permitted");
            };
        };

        switch (BTree.get(chunksInProgress, Text.compare, id)) {
            case (?uploadData) {
                if (chunkIndex >= uploadData.totalChunks) {
                    return #err("Invalid chunk index");
                };
                uploadData.chunks.add(chunk);
                Debug.print("Chunk Size" # Nat.toText(chunk.size()));
                Debug.print("Chunk Index: " # Nat.toText(chunkIndex));
                Debug.print("Total Chunks: " # Nat.toText(uploadData.totalChunks));

                // If all chunks received, combine and store
                if (uploadData.chunks.size() == uploadData.totalChunks) {
                    let completeData = concatenateChunks(uploadData.chunks);

                    Debug.print("Complete Data: " # Nat.toText(completeData.size()));
                    switch (BTree.get(dataStore, Text.compare, id)) {

                        case (?_existingData) {
                            return #err("Data already exists");
                        };
                        case null {
                            switch (await subscriptionManager.updateDataStorageUsedMap(caller, completeData.size())) {
                                case (#ok(_)) {

                                    ignore BTree.insert(dataStore, Text.compare, id, completeData);
                                    ignore BTree.delete(chunksInProgress, Text.compare, id);
                                    return #ok("Final Chunk uploaded");
                                };
                                case (#err(err)) {
                                    return #err(err);
                                };
                            };
                        };
                    };

                };
                return #ok("Chunk uploaded");
            };
            case null {
                return #err("No upload in progress for this ID");
            };
        };
    };

    // Helper function to concatenate chunks
    private func concatenateChunks(chunks : Buffer.Buffer<Blob>) : Blob {
        let arrays = Buffer.toArray(chunks);
        let totalSize = Array.foldLeft<Blob, Nat>(
            arrays,
            0,
            func(sum, chunk) {
                sum + chunk.size();
            },
        );

        let result = Buffer.Buffer<Nat8>(totalSize);
        for (chunk in arrays.vals()) {
            for (byte in chunk.vals()) {
                result.add(byte);
            };
        };

        return Blob.fromArray(Buffer.toArray(result));
    };

    // Retrieve stored data in chunks
    public shared query ({ caller }) func getDataChunk(id : Text, offset : Nat, chunkSize : Nat) : async Result.Result<Blob, Text> {
        switch (BTree.get(dataStoreAccess, Text.compare, id)) {
            case (?value) {
                if (value != caller) {
                    return #err("Not permitted");
                };
            };
            case (null) {
                return #err("Not permitted");
            };
        };
        switch (BTree.get(dataStore, Text.compare, id)) {
            case (?data) {
                let dataArray = Blob.toArray(data);
                if (offset >= dataArray.size()) {
                    return #err("Offset exceeds data size");
                };

                let remainingBytes = Int.abs(dataArray.size() - offset);
                let actualChunkSize = if (chunkSize > remainingBytes) remainingBytes else chunkSize;

                let chunk = Array.tabulate<Nat8>(
                    actualChunkSize,
                    func(i) { dataArray[offset + i] },
                );

                return #ok(Blob.fromArray(chunk));
            };
            case null {
                return #err("Data not found");
            };
        };
    };

    // Get total size of stored data
    public query func getDataSize(id : Text) : async Nat {
        switch (BTree.get(dataStore, Text.compare, id)) {
            case (?data) { data.size() };
            case null { 0 };
        };
    };

    public shared ({ caller }) func deleteDataByPermittedPrincipal(id : Text) : async Result.Result<Text, Text> {
        if (not isPermitted(caller)) {
            return #err("Not permitted");
        };

        switch (BTree.get(dataStore, Text.compare, id)) {
            case (?data) {

                let ownerResult = BTree.delete(dataStoreAccess, Text.compare, id);
                switch (ownerResult) {
                    case (?owner) {
                        switch (await subscriptionManager.updateDataStorageUsedMap(owner, -data.size())) {
                            case (#ok(_)) {

                                // Delete the data from main storage
                                ignore BTree.delete(dataStore, Text.compare, id);
                                // Delete read permissions
                                ignore BTree.delete(dataReadPermittedPrincipals, Text.compare, id);

                                return #ok("Data and associated permissions deleted");
                            };
                            case (#err(err)) {
                                return #err(err);
                            };
                        };
                    };
                    case (null) {
                        switch (await subscriptionManager.updateDataStorageUsedMap(caller, -data.size())) {
                            case (#ok(_)) {

                                // Delete the data from main storage
                                ignore BTree.delete(dataStore, Text.compare, id);
                                // Delete read permissions
                                ignore BTree.delete(dataReadPermittedPrincipals, Text.compare, id);

                                return #ok("Data and associated permissions deleted");
                            };
                            case (#err(err)) {
                                return #err(err);
                            };
                        };
                    };
                };

            };
            case null {
                return #err("Data not found");
            };
        };
    };

    public shared ({ caller }) func grantReadPermission(id : Text, principal : Principal, time : Int) : async Result.Result<Text, Text> {
        if (not isPermitted(caller)) {
            return #err("Not permitted");
        };

        // Get or create the BTree for this asset's permissions
        let permittedPrincipals = switch (BTree.get(dataReadPermittedPrincipals, Text.compare, id)) {
            case (?existing) { existing };
            case null {
                let newTree = BTree.init<Principal, Time.Time>(null);
                ignore BTree.insert(dataReadPermittedPrincipals, Text.compare, id, newTree);
                newTree;
            };
        };

        // Add or update the permission for this principal
        ignore BTree.insert(permittedPrincipals, Principal.compare, principal, time);

        return #ok("Read permission granted");
    };

    public shared ({ caller }) func revokeReadPermission(id : Text, principal : Principal) : async Result.Result<Text, Text> {
        if (not isPermitted(caller)) {
            return #err("Not permitted");
        };
        let tempPermittedPrincipals = BTree.get(dataReadPermittedPrincipals, Text.compare, id);
        switch (tempPermittedPrincipals) {
            case (?value) {
                ignore BTree.delete(value, Principal.compare, principal);
                return #ok("Read permission revoked");
            };
            case null {
                return #err("Read permission not found");
            };
        };
    };

    public shared query ({ caller }) func getDataChunkForReadPermittedPrincipal(id : Text, offset : Nat, chunkSize : Nat) : async Result.Result<Blob, Text> {
        switch (BTree.get(dataReadPermittedPrincipals, Text.compare, id)) {
            case (?value) {
                let tempPermittedPrincipals = BTree.get(value, Principal.compare, caller);
                switch (tempPermittedPrincipals) {
                    case (?time) {
                        if (Time.now() > time) {
                            return #err("Read permission expired");
                        };
                        switch (BTree.get(dataStore, Text.compare, id)) {
                            case (?data) {
                                let dataArray = Blob.toArray(data);
                                if (offset >= dataArray.size()) {
                                    return #err("Offset exceeds data size");
                                };

                                let remainingBytes = Int.abs(dataArray.size() - offset);
                                let actualChunkSize = if (chunkSize > remainingBytes) remainingBytes else chunkSize;

                                let chunk = Array.tabulate<Nat8>(
                                    actualChunkSize,
                                    func(i) { dataArray[offset + i] },
                                );

                                return #ok(Blob.fromArray(chunk));
                            };
                            case null { return #err("Data not found") };
                        };
                    };
                    case null {
                        return #err("Read permission not found test 1");
                    };
                };
            };
            case null {
                return #err("Read permission not found test 2");
            };
        };
    };

    private func isPermitted(principal : Principal) : Bool {
        for (permittedPrincipal in permittedPrincipals.vals()) {
            if (permittedPrincipal == principal) {
                return true;
            };
        };
        return false;
    };

    // Function to clear chunksInProgress at midnight
    private func clearChunksInProgress() : async () {
        BTree.clear(chunksInProgress);
    };

    // Calculate time until next midnight UTC
    private func timeUntilNextMidnight() : Nat {
        let currentTime = Int.abs(Time.now());
        ONE_DAY_NANOS - (currentTime % ONE_DAY_NANOS);
    };

    // Set up the recurring timer for daily clearing
    Timer.setTimer<system>(
        #nanoseconds(timeUntilNextMidnight()),
        func() : async () {
            ignore Timer.recurringTimer<system>(#nanoseconds(ONE_DAY_NANOS), clearChunksInProgress);
            await clearChunksInProgress();
        },
    );
};
