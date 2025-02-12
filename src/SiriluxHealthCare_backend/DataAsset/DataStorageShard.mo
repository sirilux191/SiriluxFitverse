import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import Map "mo:base/HashMap";
import Int "mo:base/Int";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import BTree "mo:stableheapbtreemap/BTree";

import CanisterTypes "../Types/CanisterTypes";

actor class DataStorageShard() {
    // Type for storing chunks temporarily
    private type ChunkData = {
        chunks : Buffer.Buffer<Blob>;
        totalChunks : Nat;
    };
    private let dataStorageService = CanisterTypes.dataStorageService;
    private stable var dataStoreAccess : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null);
    private stable var dataReadPermittedPrincipals : BTree.BTree<Text, BTree.BTree<Principal, Int>> = BTree.init<Text, BTree.BTree<Principal, Int>>(null);
    // Main storage map for completed data
    private stable var dataStore : BTree.BTree<Text, Blob> = BTree.init<Text, Blob>(null);
    // Temporary storage for chunks being uploaded
    private let chunksInProgress = Map.HashMap<Text, ChunkData>(0, Text.equal, Text.hash);
    //Permitted Principal List
    private stable var permittedPrincipals : [Principal] = [];

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

    public shared ({ caller }) func insertData(id : Text, data : Blob) : async Result.Result<Text, Text> {
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

        let dataSize = data.size();

        switch (BTree.get(dataStore, Text.compare, id)) {
            case (?existingData) {
                let existingDataSize : Int = existingData.size();
                // let newDataSize : Int = data.size();
                let totalSize : Int = existingDataSize - dataSize;
                switch (await dataStorageService.updateDataStorageUsedMap(caller, totalSize)) {
                    case (#ok()) {
                        ignore BTree.insert(dataStore, Text.compare, id, data);
                        return #ok("Data inserted");
                    };
                    case (#err(err)) {
                        return #err(err);
                    };
                };
            };
            case null {

            };
        };

        switch (await dataStorageService.updateDataStorageUsedMap(caller, dataSize)) {
            case (#ok()) {
                ignore BTree.insert(dataStore, Text.compare, id, data);
                return #ok("Data inserted");
            };
            case (#err(err)) {
                return #err(err);
            };
        };
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

        // switch (BTree.get(dataStore, Text.compare, id)) {
        //     case (?existingData) {
        //         let existingDataSize : Int = existingData.size();
        //         let newDataSize : Int = totalChunks * 2_000_000;
        //         let totalSize : Int = existingDataSize - newDataSize;
        //         Check Only Don't Update
        //         switch (await dataStorageService.checkDataStorageUsedMap(caller, totalSize)) {
        //             case (#ok()) {

        //             };
        //             case (#err(err)) {
        //                 return #err(err);
        //             };
        //         };
        //     };
        //     case null {

        //     };
        // };

        switch (chunksInProgress.get(id)) {
            case (?_) {
                return #err("Upload already in progress for this ID");
            };
            case null {
                let chunkBuffer = Buffer.Buffer<Blob>(totalChunks);
                chunksInProgress.put(
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

        switch (chunksInProgress.get(id)) {
            case (?uploadData) {
                if (chunkIndex >= uploadData.totalChunks) {
                    return #err("Invalid chunk index");
                };
                uploadData.chunks.add(chunk);

                // If all chunks received, combine and store
                if (uploadData.chunks.size() == uploadData.totalChunks) {
                    let completeData = concatenateChunks(uploadData.chunks);

                    switch (BTree.get(dataStore, Text.compare, id)) {
                        case (?existingData) {
                            let existingDataSize : Int = existingData.size();

                            let totalSize : Int = existingDataSize - completeData.size();
                            switch (await dataStorageService.updateDataStorageUsedMap(caller, totalSize)) {
                                case (#ok()) {
                                    ignore BTree.insert(dataStore, Text.compare, id, completeData);
                                    chunksInProgress.delete(id);
                                    return #ok("Chunk uploaded");
                                };
                                case (#err(err)) {
                                    return #err(err);
                                };
                            };
                        };
                        case null {

                        };
                    };

                    switch (await dataStorageService.updateDataStorageUsedMap(caller, completeData.size())) {
                        case (#ok()) {
                            ignore BTree.insert(dataStore, Text.compare, id, completeData);
                            chunksInProgress.delete(id);
                            return #ok("Chunk uploaded");
                        };
                        case (#err(err)) {
                            return #err(err);
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

    // Original getData function remains for backward compatibility
    public shared query ({ caller }) func getData(id : Text) : async Result.Result<Blob, Text> {
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
            case (?data) { return #ok(data) };
            case null { return #err("Data not found") };
        };
    };

    // Delete stored data
    public shared ({ caller }) func deleteData(id : Text) : async Result.Result<Text, Text> {
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
                switch (await dataStorageService.updateDataStorageUsedMap(caller, -data.size())) {
                    case (#ok()) {
                        ignore BTree.delete(dataStore, Text.compare, id);
                        return #ok("Data deleted");
                    };
                    case (#err(err)) {
                        return #err(err);
                    };
                };
            };
            case null {
                return #ok("Data not found");
            };
        };
    };

    public shared ({ caller }) func deleteDataByPermittedPrincipal(id : Text) : async Result.Result<Text, Text> {
        if (not isPermitted(caller)) {
            return #err("Not permitted");
        };

        switch (BTree.get(dataStore, Text.compare, id)) {
            case (?_data) {

                // Delete the data from main storage
                ignore BTree.delete(dataStore, Text.compare, id);
                // Delete access permissions
                ignore BTree.delete(dataStoreAccess, Text.compare, id);
                // Delete read permissions
                ignore BTree.delete(dataReadPermittedPrincipals, Text.compare, id);
                return #ok("Data and associated permissions deleted");

            };
            case null {
                return #err("Data not found");
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

    public shared ({ caller }) func grantReadPermission(id : Text, principal : Principal, time : Int) : async Result.Result<Text, Text> {

        if (not isPermitted(caller)) {
            return #err("Not permitted");
        };
        let tempPermittedPrincipals = BTree.init<Principal, Int>(null);
        ignore BTree.insert(tempPermittedPrincipals, Principal.compare, principal, time);
        ignore BTree.insert(dataReadPermittedPrincipals, Text.compare, id, tempPermittedPrincipals);
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

    public shared ({ caller }) func getDataforReadPermittedPrincipal(id : Text) : async Result.Result<Blob, Text> {
        switch (BTree.get(dataReadPermittedPrincipals, Text.compare, id)) {
            case (?value) {
                let tempPermittedPrincipals = BTree.get(value, Principal.compare, caller);
                switch (tempPermittedPrincipals) {
                    case (?_time) {
                        switch (BTree.get(dataStore, Text.compare, id)) {
                            case (?data) { return #ok(data) };
                            case null { return #err("Data not found") };
                        };
                    };
                    case null {
                        return #err("Read permission not found");
                    };
                };
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
                    case (?_time) {
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
                        return #err("Read permission not found");
                    };
                };
            };
            case null {
                return #err("Read permission not found");
            };
        };
    };
};
