// src/streamers/transaction-streamer.ts
import {
  CommitmentLevel
} from "@triton-one/yellowstone-grpc";
import Client from "@triton-one/yellowstone-grpc";
var TransactionStreamer = class {
  client;
  request;
  addresses = /* @__PURE__ */ new Set();
  running = false;
  stream;
  parser = void 0;
  idlInstructionNames = /* @__PURE__ */ new Set();
  onInstructionCallbacks = {};
  onDataCallback;
  onErrorCallback;
  onEndCallback;
  onCloseCallback;
  /**
   * Initializes the TransactionStreamer, which can be used to stream transactions and parse them using the provided parser
   * @param endpoint Accepts your Yellowstone gRPC Connection URL
   * @param xToken Accepts your X-token, which is used for authentication
   */
  constructor(endpoint, xToken) {
    this.client = new Client(endpoint, xToken, void 0);
    this.request = {
      accounts: {},
      slots: {},
      transactions: {},
      transactionsStatus: {},
      entry: {},
      blocks: {},
      blocksMeta: {},
      accountsDataSlice: [],
      ping: void 0,
      commitment: CommitmentLevel.PROCESSED
    };
  }
  /**
  * Registers a callback to be triggered when a specific instruction is detected in a transaction.
  * @param instructionName The instruction name (must exist in IDL)
  * @param callback The function to invoke when that instruction appears in a transaction
  */
  onDetectInstruction(instructionName, callback) {
    if (!this.idlInstructionNames.has(instructionName)) {
      console.warn(`Instruction ${instructionName} not found in IDL`);
      return;
    }
    this.onInstructionCallbacks[instructionName] = callback;
  }
  /**
   * Sets a callback function to be called when a transaction is received.
   * The callback function takes a single parameter, which is the transaction data.
   * @param callback The callback function to call when a transaction is received.
   */
  onData(callback) {
    this.onDataCallback = callback;
  }
  /**
   * Sets a callback function to be called when an error occurs while streaming transactions.
   * The callback function takes one argument, which is the error that occurred.
   * @param callback The callback function to call when an error occurs
   */
  onError(callback) {
    this.onErrorCallback = callback;
  }
  /**
   * Fired when the stream has ended.
   * @param callback Accepts a callback function, which takes no arguments
   */
  onEnd(callback) {
    this.onEndCallback = callback;
  }
  /**
   * Sets a callback function to be called when the stream has been closed.
   * This is called after the stream has been ended and the stream is no longer available.
   * @param callback The callback function to call when the stream has been closed.
   */
  onClose(callback) {
    this.onCloseCallback = callback;
  }
  updateRequest() {
    this.request = {
      ...this.request,
      transactions: {
        tracked: {
          vote: false,
          failed: false,
          signature: void 0,
          accountInclude: Array.from(this.addresses),
          accountExclude: [],
          accountRequired: []
        }
      }
    };
  }
  async pushUpdate() {
    if (!this.stream) return;
    this.updateRequest();
    await new Promise((resolve, reject) => {
      this.stream.write(this.request, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  /**
   * Adds a list of addresses to the transaction stream request.
   * Transactions from these addresses will be included in the transaction stream.
   * @param newAddresses The list of addresses to add to the transaction stream request.
  */
  async addAddresses(newAddresses) {
    newAddresses.forEach((addr) => this.addresses.add(addr));
    await this.pushUpdate();
  }
  /**
   * Removes a list of addresses from the transaction stream request.
   * Transactions from these addresses will no longer be included in the transaction stream.
   * @param removeList The list of addresses to remove from the transaction stream request.
   */
  async removeAddresses(removeList) {
    removeList.forEach((addr) => this.addresses.delete(addr));
    await this.pushUpdate();
  }
  /**
   * Adds a parser, which is created using the Parser class, to the transaction streamer. The parser is used to parse the transactions and accounts data received from the stream.
   * @param parser The parser to add to the transaction streamer.
   */
  async addParser(parser) {
    this.parser = parser;
    this.idlInstructionNames = parser.getAllInstructions();
  }
  /**
   * Starts the transaction stream, which will keep running until stop is called.
   * The stream will retry indefinitely if an error occurs, with a maximum delay of 30s.
   * The delay between retries will double each time an error occurs, up to a maximum of 30s.
   */
  async start() {
    this.running = true;
    while (this.running) {
      try {
        await this.handleStream();
      } catch (error) {
        console.error("Stream error, retrying in 1s...", error);
        if (!this.running) break;
        await new Promise((res) => setTimeout(res, 1e3));
      }
    }
  }
  /**
   * Stops the transaction stream if it is currently running.
   * This will prevent any further transactions from being received until
   * `start` is called again.
   */
  stop() {
    this.running = false;
    this.stream?.cancel();
    this.stream = void 0;
  }
  async handleStream() {
    this.stream = await this.client.subscribe();
    const streamClosed = new Promise((resolve, reject) => {
      this.stream.on("error", (err) => {
        if (this.onErrorCallback) this.onErrorCallback(err);
        reject(err);
        this.stream?.cancel();
      });
      this.stream.on("end", () => {
        if (this.onEndCallback) this.onEndCallback();
        resolve();
      });
      this.stream.on("close", () => {
        if (this.onCloseCallback) this.onCloseCallback();
        resolve();
      });
    });
    this.stream.on("data", (data) => {
      try {
        const tx = this.parser ? this.parser.parseTransaction(
          this.parser.formatGrpcTransactionData(data.transaction, Date.now())
        ) : data;
        this.detectInstructionType(tx);
        if (this.onDataCallback) this.onDataCallback(tx);
      } catch (err) {
        if (this.onErrorCallback) this.onErrorCallback(err);
      }
    });
    await this.pushUpdate();
    await streamClosed;
    this.stream = void 0;
  }
  /**
   * Detects which IDL instruction(s) are present in the transaction and calls the corresponding callbacks.
   * @param tx The transaction data.
   */
  detectInstructionType(tx) {
    try {
      const message = tx?.transaction?.message;
      if (!message) return;
      let instructions = message.instructions || message.compiledInstructions || [];
      const innerInstructions = Array.isArray(tx.meta?.innerInstructions) ? tx.meta.innerInstructions.flatMap((ix) => ix.instructions || []) : [];
      const allInstructions = [...instructions, ...innerInstructions];
      for (const ix of allInstructions) {
        const name = ix?.data?.name;
        if (name && this.onInstructionCallbacks[name]) {
          this.onInstructionCallbacks[name](tx);
          break;
        }
      }
    } catch (err) {
      if (this.onErrorCallback) this.onErrorCallback(err);
    }
  }
};

// src/streamers/account-streamer.ts
import {
  CommitmentLevel as CommitmentLevel2
} from "@triton-one/yellowstone-grpc";
import Client2 from "@triton-one/yellowstone-grpc";
var AccountStreamer = class {
  client;
  request;
  addresses = /* @__PURE__ */ new Set();
  owners = /* @__PURE__ */ new Set();
  running = false;
  stream;
  onDataCallback;
  onErrorCallback;
  onEndCallback;
  onCloseCallback;
  parser = void 0;
  /**
   * Initializes the AccountStreamer, which can be used to stream account data and parse it using the provided parser
   * @param endpoint Accepts your Yellowstone gRPC Connection URL
   * @param xToken Accepts your X-token, which is used for authentication
   */
  constructor(endpoint, xToken) {
    this.client = new Client2(endpoint, xToken, void 0);
    this.request = {
      accounts: {},
      slots: {},
      transactions: {},
      transactionsStatus: {},
      entry: {},
      blocks: {},
      blocksMeta: {},
      accountsDataSlice: [],
      ping: void 0,
      commitment: CommitmentLevel2.PROCESSED
    };
  }
  /**
   * Sets a callback function to be called when account data is received.
   * The callback function takes a single parameter, which is the account data.
   * @param callback The callback function to call when account data is received.
   */
  onData(callback) {
    this.onDataCallback = callback;
  }
  /**
   * Sets a callback function to be called when an error occurs while streaming account data.
   * The callback function takes a single parameter, which is the error that occurred.
   * @param callback The callback function to call when an error occurs
   */
  onError(callback) {
    this.onErrorCallback = callback;
  }
  /**
   * Fired when the stream has ended. This is called after the stream has been ended and the stream is no longer available.
   * @param callback Accepts a callback function, which takes no arguments
   */
  onEnd(callback) {
    this.onEndCallback = callback;
  }
  /**
   * Sets a callback function to be called when the stream has been closed.
   * This is called after the stream has been ended and the stream is no longer available.
   * @param callback Accepts a callback function, which takes no arguments
   */
  onClose(callback) {
    this.onCloseCallback = callback;
  }
  updateRequest() {
    this.request = {
      ...this.request,
      accounts: {
        program_name: {
          account: Array.from(this.addresses),
          filters: [],
          owner: Array.from(this.owners)
        }
      }
    };
  }
  async pushUpdate() {
    if (!this.stream) return;
    this.updateRequest();
    await new Promise((resolve, reject) => {
      this.stream.write(this.request, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  /**
   * Adds a list of addresses to the account stream request.
   * Accounts from these addresses will be included in the account stream.
   * @param newAddresses The list of addresses to add to the account stream request.
   */
  async addAddresses(newAddresses) {
    newAddresses.forEach((addr) => this.addresses.add(addr));
    await this.pushUpdate();
  }
  /**
   * Removes a list of addresses from the account stream request.
   * Accounts from these addresses will no longer be included in the account stream.
   * @param removeList The list of addresses to remove from the account stream request.
   */
  async removeAddresses(removeList) {
    removeList.forEach((addr) => this.addresses.delete(addr));
    await this.pushUpdate();
  }
  /**
   * Adds a list of addresses to the account stream request as owners.
   * Accounts for which these addresses are owners will be included in the account stream.
   * @param newOwners The list of addresses to add to the account stream request as owners.
   */
  async addOwners(newOwners) {
    newOwners.forEach((addr) => this.owners.add(addr));
    await this.pushUpdate();
  }
  /**
   * Removes a list of addresses from the account stream request as owners.
   * Accounts for which these addresses are no longer owners will no longer be included in the account stream.
   * @param removeList The list of addresses to remove from the account stream request as owners.
   */
  async removeOwners(removeList) {
    removeList.forEach((addr) => this.owners.delete(addr));
    await this.pushUpdate();
  }
  async addParser(parser) {
    this.parser = parser;
  }
  /**
   * Starts the account stream, which will keep running until stop is called.
   * The stream will retry indefinitely if an error occurs, with a maximum delay of 30s.
   * The delay between retries will double each time an error occurs, up to a maximum of 30s.
   */
  async start() {
    this.running = true;
    while (this.running) {
      try {
        await this.handleStream();
      } catch (error) {
        console.error("Stream error, retrying in 1s...", error);
        if (this.onErrorCallback) this.onErrorCallback(error);
        if (!this.running) break;
        await new Promise((res) => setTimeout(res, 1e3));
      }
    }
  }
  /**
   * Stops the account stream if it is currently running.
   * This will prevent any further accounts from being received until
   * `start` is called again.
   */
  stop() {
    this.running = false;
    this.stream?.cancel();
    this.stream = void 0;
  }
  async handleStream() {
    console.log("Subscribing and starting account stream...");
    this.stream = await this.client.subscribe();
    const streamClosed = new Promise((resolve, reject) => {
      this.stream.on("error", (err) => {
        if (this.onErrorCallback) this.onErrorCallback(err);
        reject(err);
        this.stream.cancel();
      });
      this.stream.on("end", () => {
        if (this.onEndCallback) this.onEndCallback();
        resolve();
      });
      this.stream.on("close", () => {
        if (this.onCloseCallback) this.onCloseCallback();
        resolve();
      });
    });
    this.stream.on("data", (data) => {
      if (this.onDataCallback) {
        try {
          if (data.account) {
            if (this.parser === void 0) {
              this.onDataCallback(data);
              return;
            }
            const formattedData = this.parser.formatGeyserAccountData(data.account);
            const parsedData = this.parser.parseAccount(formattedData);
            this.onDataCallback(parsedData);
          } else {
            this.onDataCallback(data);
          }
        } catch (err) {
          if (this.onErrorCallback) this.onErrorCallback(err);
        }
      }
    });
    await this.pushUpdate();
    await streamClosed;
    this.stream = void 0;
  }
};

// src/parsers/parser.ts
import {
  PublicKey as PublicKey2,
  Message,
  MessageV0
} from "@solana/web3.js";
import {
  BorshCoder as CoralBorshCoder,
  utils,
  EventParser as CoralEventParser
} from "@coral-xyz/anchor";
import {
  BorshCoder as SerumBorshCoder,
  BorshAccountsCoder as SerumBorshAccountsCoder,
  EventParser as SerumEventParser
} from "@project-serum/anchor";
import { intersection } from "lodash";

// src/utils/account-formatter.ts
var asIs = (f) => f;
var BORSH_TO_DB_MAPPINGS = {
  u8: asIs,
  u16: asIs,
  u32: asIs,
  u64: (t) => t.toString(10),
  u128: (t) => t.toString(10),
  u256: (t) => t.toString(10),
  i8: asIs,
  i16: asIs,
  i32: asIs,
  i64: (t) => t.toString(10),
  i128: (t) => t.toString(10),
  i256: (t) => t.toString(10),
  f32: asIs,
  f64: (t) => t.toString(10),
  f128: (t) => t.toString(10),
  publicKey: (t) => t?.toBase58(),
  pubkey: (t) => t?.toBase58(),
  bool: asIs,
  //string: asIs,
  //adding a filter for strings with null characters, causing errors while inserting in postgres
  string: (t) => {
    t = t.replace(/\0/g, "");
    return t.toString();
  },
  bytes: asIs
};
function serializeField(input, field, types) {
  if (typeof field.type === "object") {
    if ("option" in field.type) {
      const newField = { name: field.name, type: field.type.option };
      return input ? serializeField(input, newField, types) : null;
    } else if ("vec" in field.type) {
      const type = field.type.vec;
      const newField = { name: field.name, type };
      return input.map((i) => serializeField(i, newField, types));
    } else if ("array" in field.type) {
      const [fieldType] = field.type.array;
      const newField = { name: field.name, type: fieldType };
      return input.map((i) => serializeField(i, newField, types));
    } else if ("defined" in field.type) {
      let definedType;
      if (typeof field.type.defined !== "string") {
        definedType = field.type.defined.name;
      } else {
        definedType = field.type.defined;
      }
      if (!types) {
        throw new Error(`Types not defined in current idl. Failed while trying to find ${definedType}`);
      }
      const type = types.find((t) => t.name === definedType);
      if (!type) {
        throw new Error(`Cannot find given type, ${definedType} in idl while serializing field ${field.name}`);
      }
      return serializeDefinedType(input, type, types);
    } else {
      throw new Error(`Invalid field type. Input: ${JSON.stringify(field)}`);
    }
  }
  const mapping = BORSH_TO_DB_MAPPINGS[field.type];
  if (!mapping) {
    throw new Error(`Unknown idl field type ${field.type}`);
  }
  return mapping(input);
}
function serializeDefinedType(input, type, allTypes) {
  if (type.type.kind === "enum") {
    return serializeEnum(input, type.type.variants, allTypes);
  } else if (type.type.kind === "struct") {
    const newField = type.type.fields;
    return serializeStruct(input, newField, allTypes);
  } else {
    throw new Error(`Unknown deifned kind ${JSON.stringify(type.type)} while serliazing input ${JSON.stringify(input)}`);
  }
}
function serializeStruct(input, type, allTypes) {
  const result = {};
  for (const field of type) {
    const newField = { name: "", type: field.type };
    result[field.name] = serializeField(input[field.name], newField, allTypes);
  }
  return result;
}
function serializeEnum(input, variants, allTypes) {
  const variant = Object.keys(input)[0];
  const lowerCaseVariant = variant.toLowerCase();
  const serializer = variants.find((v) => v.name.toLowerCase() === lowerCaseVariant);
  if (!serializer) {
    throw new Error(`Invalid enum variant ${variant} for field ${JSON.stringify(input)}`);
  }
  return { [variant]: serializeEnumFields(input[variant], serializer, allTypes) };
}
function serializeEnumFields(input, enumVariant, allTypes) {
  const inputKeys = Object.keys(input);
  if (inputKeys.length === 0) {
    return {};
  }
  const result = {};
  for (const field of enumVariant.fields) {
    if (typeof field === "string" || !("name" in field)) {
      throw new Error(`Not implemented tuple serialization for enum.`);
    } else if ("name" in field) {
      result[field.name] = serializeField(input[field.name], field, allTypes);
    }
  }
  return result;
}

// src/utils/common.ts
import { isObject } from "lodash";
function plaintextFormatter(obj) {
  for (const key in obj) {
    if (obj[key]?.constructor?.name === "PublicKey") {
      obj[key] = obj[key].toBase58();
    } else if (obj[key]?.constructor?.name === "BN") {
      obj[key] = Number(obj[key].toString());
    } else if (obj[key]?.constructor?.name === "BigInt") {
      obj[key] = Number(obj[key].toString());
    } else if (obj[key]?.constructor?.name === "Buffer") {
      obj[key] = obj[key].toString("base64");
    } else if (isObject(obj[key])) {
      plaintextFormatter(obj[key]);
    }
  }
  return obj;
}
function buildAccountMetaMap(accountKeys, header, loadedAddresses) {
  const map = /* @__PURE__ */ new Map();
  const {
    numRequiredSignatures,
    numReadonlySignedAccounts,
    numReadonlyUnsignedAccounts
  } = header;
  const totalKeys = accountKeys.length;
  for (let i = 0; i < totalKeys; i++) {
    const pubkey = accountKeys[i];
    const isSigner = i < numRequiredSignatures;
    let isWritable;
    if (isSigner) {
      isWritable = i < numRequiredSignatures - numReadonlySignedAccounts;
    } else {
      const unsignedIndex = i - numRequiredSignatures;
      isWritable = unsignedIndex < totalKeys - numRequiredSignatures - numReadonlyUnsignedAccounts;
    }
    map.set(pubkey, { pubkey, isSigner, isWritable });
  }
  if (loadedAddresses) {
    loadedAddresses.readonly.forEach((pubkey) => {
      map.set(pubkey, { pubkey, isSigner: false, isWritable: false });
    });
    loadedAddresses.writable.forEach((pubkey) => {
      map.set(pubkey, { pubkey, isSigner: false, isWritable: true });
    });
  }
  return map;
}
function getInstructionAccountMetas(accountKeys, accountMetaMap) {
  const metas = [];
  for (const key of accountKeys) {
    for (const [pubkey, meta] of accountMetaMap.entries()) {
      if (pubkey.toBase58() === key) {
        metas.push(meta);
        break;
      }
    }
  }
  return metas;
}

// src/parsers/parser.ts
import { TOKEN_2022_PROGRAM_ID as TOKEN_2022_PROGRAM_ID2, TOKEN_PROGRAM_ID as TOKEN_PROGRAM_ID2 } from "@solana/spl-token";

// src/parsers/token-program-parser.ts
import {
  TokenInstruction,
  decodeApproveCheckedInstruction,
  decodeApproveInstruction,
  decodeBurnCheckedInstruction,
  decodeBurnInstruction,
  decodeCloseAccountInstruction,
  decodeFreezeAccountInstruction,
  decodeInitializeAccountInstruction,
  decodeInitializeMintInstructionUnchecked,
  decodeInitializeMultisigInstruction,
  decodeMintToCheckedInstruction,
  decodeMintToInstruction,
  decodeRevokeInstruction,
  decodeSetAuthorityInstruction,
  decodeThawAccountInstruction,
  decodeTransferCheckedInstruction,
  decodeTransferInstruction,
  decodeAmountToUiAmountInstruction,
  decodeInitializeAccount2Instruction,
  decodeInitializeAccount3Instruction,
  decodeInitializeMint2Instruction,
  decodeSyncNativeInstruction,
  decodeUiAmountToAmountInstruction
} from "@solana/spl-token";
function decodeTokenInstruction(instruction) {
  try {
    const discriminator = instruction.data[0];
    let parsed;
    switch (discriminator) {
      case TokenInstruction.InitializeAccount: {
        const decodedInsr = decodeInitializeAccountInstruction(instruction, instruction.programId);
        parsed = {
          name: "initializeAccount",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.InitializeAccount2: {
        const decodedInsr = decodeInitializeAccount2Instruction(instruction, instruction.programId);
        parsed = {
          name: "initializeAccount2",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.InitializeAccount3: {
        const decodedInsr = decodeInitializeAccount3Instruction(instruction, instruction.programId);
        parsed = {
          name: "initializeAccount3",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.InitializeMint: {
        const decodedInsr = decodeInitializeMintInstructionUnchecked(instruction);
        parsed = {
          name: "initializeMint",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.InitializeMint2: {
        const decodedInsr = decodeInitializeMint2Instruction(instruction, instruction.programId);
        parsed = {
          name: "initializeMint2",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.InitializeMultisig: {
        const decodedInsr = decodeInitializeMultisigInstruction(instruction, instruction.programId);
        parsed = {
          name: "initializeMultisig",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.Transfer: {
        const decodedInsr = decodeTransferInstruction(instruction, instruction.programId);
        parsed = {
          name: "transfer",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.TransferChecked: {
        const decodedInsr = decodeTransferCheckedInstruction(instruction, instruction.programId);
        parsed = {
          name: "transferChecked",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.Approve: {
        const decodedInsr = decodeApproveInstruction(instruction, instruction.programId);
        parsed = {
          name: "approve",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.ApproveChecked: {
        const decodedInsr = decodeApproveCheckedInstruction(instruction, instruction.programId);
        parsed = {
          name: "approveChecked",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.Revoke: {
        const decodedInsr = decodeRevokeInstruction(instruction, instruction.programId);
        parsed = {
          name: "revoke",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.SetAuthority: {
        const decodedInsr = decodeSetAuthorityInstruction(instruction, instruction.programId);
        parsed = {
          name: "setAuthority",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.MintTo: {
        const decodedInsr = decodeMintToInstruction(instruction, instruction.programId);
        parsed = {
          name: "mintTo",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.MintToChecked: {
        const decodedInsr = decodeMintToCheckedInstruction(instruction, instruction.programId);
        parsed = {
          name: "mintToChecked",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.Burn: {
        const decodedInsr = decodeBurnInstruction(instruction, instruction.programId);
        parsed = {
          name: "burn",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.BurnChecked: {
        const decodedInsr = decodeBurnCheckedInstruction(instruction, instruction.programId);
        parsed = {
          name: "burnChecked",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.CloseAccount: {
        const decodedInsr = decodeCloseAccountInstruction(instruction, instruction.programId);
        parsed = {
          name: "closeAccount",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.FreezeAccount: {
        const decodedInsr = decodeFreezeAccountInstruction(instruction, instruction.programId);
        parsed = {
          name: "freezeAccount",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.ThawAccount: {
        const decodedInsr = decodeThawAccountInstruction(instruction, instruction.programId);
        parsed = {
          name: "thawAccount",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.SyncNative: {
        const decodedInsr = decodeSyncNativeInstruction(instruction, instruction.programId);
        parsed = {
          name: "syncNative",
          data: decodedInsr
        };
        break;
      }
      case TokenInstruction.AmountToUiAmount: {
        const decodedInsr = decodeAmountToUiAmountInstruction(instruction, instruction.programId);
        parsed = {
          name: "amountToUiAmount",
          data: decodedInsr
        };
      }
      case TokenInstruction.UiAmountToAmount: {
        const decodedInsr = decodeUiAmountToAmountInstruction(instruction, instruction.programId);
        parsed = {
          name: "uiAmountToAmount",
          data: decodedInsr
        };
        break;
      }
      default: {
        parsed = {
          name: "unknown",
          data: {}
        };
        break;
      }
    }
    return parsed;
  } catch (error) {
    console.log("Error decoding token instruction: ", error);
    return {
      name: "unknown",
      data: {}
    };
  }
}

// src/parsers/parser.ts
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";

// src/parsers/system-program-parser.ts
import { SystemInstruction, SystemProgram } from "@solana/web3.js";
function decodeSystemInstruction(instruction) {
  try {
    const ixType = SystemInstruction.decodeInstructionType(instruction);
    let decoded;
    switch (ixType) {
      case "AdvanceNonceAccount": {
        const decodedInstr = SystemInstruction.decodeNonceAdvance(instruction);
        decoded = {
          name: "advanceNonceAccount",
          data: decodedInstr
        };
        break;
      }
      case "Allocate": {
        const decodedInstr = SystemInstruction.decodeAllocate(instruction);
        decoded = {
          name: "allocate",
          data: decodedInstr
        };
        break;
      }
      case "AllocateWithSeed": {
        const decodedInstr = SystemInstruction.decodeAllocateWithSeed(instruction);
        decoded = {
          name: "allocateWithSeed",
          data: decodedInstr
        };
        break;
      }
      case "Assign": {
        const decodedInstr = SystemInstruction.decodeAssign(instruction);
        decoded = {
          name: "assign",
          data: decodedInstr
        };
        break;
      }
      case "AssignWithSeed": {
        const decodedInstr = SystemInstruction.decodeAssignWithSeed(instruction);
        decoded = {
          name: "assignWithSeed",
          data: decodedInstr
        };
        break;
      }
      case "AuthorizeNonceAccount": {
        const decodedInstr = SystemInstruction.decodeNonceAuthorize(instruction);
        decoded = {
          name: "authorizeNonceAccount",
          data: decodedInstr
        };
        break;
      }
      case "Create": {
        const decodedInstr = SystemInstruction.decodeCreateAccount(instruction);
        decoded = {
          name: "create",
          data: decodedInstr
        };
        break;
      }
      case "CreateWithSeed": {
        const decodedInstr = SystemInstruction.decodeCreateWithSeed(instruction);
        decoded = {
          name: "createWithSeed",
          data: decodedInstr
        };
        break;
      }
      case "InitializeNonceAccount": {
        const decodedInstr = SystemInstruction.decodeNonceInitialize(instruction);
        decoded = {
          name: "initializeNonceAccount",
          data: decodedInstr
        };
        break;
      }
      case "Transfer": {
        const decodedInstr = SystemInstruction.decodeTransfer(instruction);
        decoded = {
          name: "transfer",
          data: decodedInstr
        };
        break;
      }
      case "TransferWithSeed": {
        const decodedInstr = SystemInstruction.decodeTransferWithSeed(instruction);
        decoded = {
          name: "transferWithSeed",
          data: decodedInstr
        };
        break;
      }
      case "WithdrawNonceAccount": {
        const decodedInstr = SystemInstruction.decodeNonceWithdraw(instruction);
        decoded = {
          name: "withdrawNonceAccount",
          data: decodedInstr
        };
        break;
      }
      default: {
        decoded = {
          programId: SystemProgram.programId,
          name: "unknown",
          accounts: instruction.keys,
          args: { unknown: instruction.data }
        };
      }
    }
    return decoded;
  } catch (error) {
    console.log("Error Decoding System Instruction: ", error);
    return {
      programId: SystemProgram.programId,
      name: "unknown",
      accounts: instruction.keys,
      args: { unknown: instruction.data }
    };
  }
}

// src/parsers/token-2022-parser.ts
import {
  TokenInstruction as TokenInstruction3,
  decodeApproveCheckedInstruction as decodeApproveCheckedInstruction2,
  decodeApproveInstruction as decodeApproveInstruction2,
  decodeBurnCheckedInstruction as decodeBurnCheckedInstruction2,
  decodeBurnInstruction as decodeBurnInstruction2,
  decodeCloseAccountInstruction as decodeCloseAccountInstruction2,
  decodeFreezeAccountInstruction as decodeFreezeAccountInstruction2,
  decodeInitializeAccountInstruction as decodeInitializeAccountInstruction2,
  decodeInitializeMintInstructionUnchecked as decodeInitializeMintInstructionUnchecked2,
  decodeInitializeMultisigInstruction as decodeInitializeMultisigInstruction2,
  decodeMintToInstruction as decodeMintToInstruction2,
  decodeRevokeInstruction as decodeRevokeInstruction2,
  decodeSetAuthorityInstruction as decodeSetAuthorityInstruction2,
  decodeThawAccountInstruction as decodeThawAccountInstruction2,
  decodeTransferCheckedInstruction as decodeTransferCheckedInstruction2,
  decodeTransferInstruction as decodeTransferInstruction2,
  decodeAmountToUiAmountInstruction as decodeAmountToUiAmountInstruction2,
  decodeInitializeAccount2Instruction as decodeInitializeAccount2Instruction2,
  decodeInitializeAccount3Instruction as decodeInitializeAccount3Instruction2,
  decodeInitializeMint2Instruction as decodeInitializeMint2Instruction2,
  decodeInitializeImmutableOwnerInstruction as decodeInitializeImmutableOwnerInstruction2,
  decodeInitializeMintCloseAuthorityInstruction,
  decodeUiAmountToAmountInstruction as decodeUiAmountToAmountInstruction2,
  TransferFeeInstruction as TransferFeeInstruction2,
  decodeInitializeTransferFeeConfigInstruction,
  decodeTransferCheckedWithFeeInstruction,
  decodeWithdrawWithheldTokensFromMintInstruction,
  decodeWithdrawWithheldTokensFromAccountsInstruction,
  decodeHarvestWithheldTokensToMintInstruction,
  DefaultAccountStateInstruction,
  defaultAccountStateInstructionData,
  memoTransferInstructionData,
  cpiGuardInstructionData,
  decodeInitializePermanentDelegateInstruction,
  TransferHookInstruction,
  initializeTransferHookInstructionData,
  updateTransferHookInstructionData,
  MetadataPointerInstruction,
  initializeMetadataPointerData,
  updateMetadataPointerData,
  GroupMemberPointerInstruction,
  initializeGroupMemberPointerData,
  updateGroupMemberPointerData,
  decodeSetTransferFeeInstruction
} from "@solana/spl-token";
import { splDiscriminate } from "@solana/spl-type-length-value";

// src/decoders/layouts.ts
import { getU8Codec } from "@solana/codecs";
import { getArrayCodec, getBytesCodec, getStructCodec, getTupleCodec, getUnitCodec, getDataEnumCodec, getBooleanCodec } from "@solana/codecs-data-structures";
import { getOptionCodec, getU64Codec } from "@solana/codecs";
import { getUtf8Codec } from "@solana/codecs-strings";
import { struct, u16, u8 as u82 } from "@solana/buffer-layout";

// src/decoders/marshmallow.ts
import { PublicKey } from "@solana/web3.js";
import BN, { isBN } from "bn.js";

// src/decoders/buffer-layout.ts
import {
  bits as _bits,
  BitStructure as _BitStructure,
  blob as _blob,
  Blob as _Blob,
  cstr as _cstr,
  f32 as _f32,
  f32be as _f32be,
  f64 as _f64,
  f64be as _f64be,
  greedy as _greedy,
  Layout as _Layout,
  ns64 as _ns64,
  ns64be as _ns64be,
  nu64 as _nu64,
  nu64be as _nu64be,
  offset as _offset,
  s16 as _s16,
  s16be as _s16be,
  s24 as _s24,
  s24be as _s24be,
  s32 as _s32,
  s32be as _s32be,
  s40 as _s40,
  s40be as _s40be,
  s48 as _s48,
  s48be as _s48be,
  s8 as _s8,
  seq as _seq,
  struct as _struct,
  Structure as _Structure,
  u16 as _u16,
  u16be as _u16be,
  u24 as _u24,
  u24be as _u24be,
  u32 as _u32,
  u32be as _u32be,
  u40 as _u40,
  u40be as _u40be,
  u48 as _u48,
  u48be as _u48be,
  u8 as _u8,
  UInt as _UInt,
  union as _union,
  Union as _Union,
  unionLayoutDiscriminator as _unionLayoutDiscriminator,
  utf8 as _utf8
} from "@solana/buffer-layout";
var Layout = _Layout;
var blob = _blob;

// src/decoders/marshmallow.ts
var BNLayout = class extends Layout {
  blob;
  signed;
  constructor(span, signed, property) {
    super(span, property);
    this.blob = blob(span);
    this.signed = signed;
  }
  /** @override */
  decode(b, offset2 = 0) {
    const num = new BN(this.blob.decode(b, offset2), 10, "le");
    if (this.signed) {
      return num.fromTwos(this.span * 8).clone();
    }
    return num;
  }
  /** @override */
  encode(src, b, offset2 = 0) {
    if (typeof src === "number") src = new BN(src);
    if (this.signed) {
      src = src.toTwos(this.span * 8);
    }
    return this.blob.encode(src.toArrayLike(Buffer, "le", this.span), b, offset2);
  }
};
function u64(property) {
  return new BNLayout(8, false, property);
}

// src/decoders/layouts.ts
import {
  TokenInstruction as TokenInstruction2,
  TokenInvalidInstructionDataError,
  TokenInvalidInstructionKeysError,
  TokenInvalidInstructionProgramError,
  TokenInvalidInstructionTypeError,
  TransferFeeInstruction
} from "@solana/spl-token";
var token2022Discriminator = struct([u82("instruction")]);
var getAccountDataSizeLayout = getStructCodec([
  ["instruction", getU8Codec()],
  ["extensions", getArrayCodec(getU8Codec(), { size: 1 })]
]);
var metadataLayout = getStructCodec([
  ["instruction", getBytesCodec()],
  ["name", getUtf8Codec()],
  ["symbol", getUtf8Codec()],
  ["uri", getUtf8Codec()],
  ["additionalMetadata", getArrayCodec(getTupleCodec([getUtf8Codec(), getUtf8Codec()]))]
]);
var getFieldCodec = () => [
  ["Name", getUnitCodec()],
  ["Symbol", getUnitCodec()],
  ["Uri", getUnitCodec()],
  ["Key", getStructCodec([["value", getTupleCodec([getUtf8Codec()])]])]
];
var updateMetadataLayout = getStructCodec([
  ["instruction", getBytesCodec()],
  ["field", getDataEnumCodec(getFieldCodec())],
  ["value", getUtf8Codec()]
]);
var removeKeyLayout = getStructCodec([
  ["idempotent", getBooleanCodec()],
  ["key", getUtf8Codec()]
]);
var updateAuthorityLayout = getStructCodec([["newAuthority", getBytesCodec()]]);
var emitLayout = getStructCodec([
  ["start", getOptionCodec(getU64Codec())],
  ["end", getOptionCodec(getU64Codec())]
]);
var setTransferFeeInstructionData = struct([
  u82("instruction"),
  u82("transferFeeInstruction"),
  u16("transferFeeBasisPoints"),
  u64("maximumFee")
]);

// src/parsers/token-2022-parser.ts
function decodeToken2022Instruction(instruction) {
  let discriminator = instruction.data[0];
  let decoded;
  switch (discriminator) {
    case TokenInstruction3.InitializeMint: {
      const data = decodeInitializeMintInstructionUnchecked2(instruction);
      decoded = {
        name: "initializeMint",
        data
      };
      break;
    }
    case TokenInstruction3.InitializeAccount: {
      const data = decodeInitializeAccountInstruction2(instruction, instruction.programId);
      decoded = {
        name: "initializeAccount",
        data
      };
      break;
    }
    case TokenInstruction3.InitializeMultisig: {
      const data = decodeInitializeMultisigInstruction2(instruction, instruction.programId);
      decoded = {
        name: "initializeMultisig",
        data
      };
      break;
    }
    case TokenInstruction3.Transfer: {
      const data = decodeTransferInstruction2(instruction, instruction.programId);
      decoded = {
        name: "transfer",
        data
      };
      break;
    }
    case TokenInstruction3.Approve: {
      const data = decodeApproveInstruction2(instruction, instruction.programId);
      decoded = {
        name: "approve",
        data
      };
      break;
    }
    case TokenInstruction3.Revoke: {
      const data = decodeRevokeInstruction2(instruction, instruction.programId);
      decoded = {
        name: "revoke",
        data
      };
      break;
    }
    case TokenInstruction3.SetAuthority: {
      const data = decodeSetAuthorityInstruction2(instruction, instruction.programId);
      decoded = {
        name: "setAuthority",
        data
      };
      break;
    }
    case TokenInstruction3.MintTo: {
      const data = decodeMintToInstruction2(instruction, instruction.programId);
      decoded = {
        name: "mintTo",
        data
      };
      break;
    }
    case TokenInstruction3.Burn: {
      const data = decodeBurnInstruction2(instruction, instruction.programId);
      decoded = {
        name: "burn",
        data
      };
      break;
    }
    case TokenInstruction3.CloseAccount: {
      const data = decodeCloseAccountInstruction2(instruction, instruction.programId);
      decoded = {
        name: "closeAccount",
        data
      };
      break;
    }
    case TokenInstruction3.FreezeAccount: {
      const data = decodeFreezeAccountInstruction2(instruction, instruction.programId);
      decoded = {
        name: "freezeAccount",
        data
      };
      break;
    }
    case TokenInstruction3.ThawAccount: {
      const data = decodeThawAccountInstruction2(instruction, instruction.programId);
      decoded = {
        name: "thawAccount",
        data
      };
      break;
    }
    case TokenInstruction3.TransferChecked: {
      const data = decodeTransferCheckedInstruction2(instruction, instruction.programId);
      decoded = {
        name: "transferChecked",
        data
      };
      break;
    }
    case TokenInstruction3.ApproveChecked: {
      const data = decodeApproveCheckedInstruction2(instruction, instruction.programId);
      decoded = {
        name: "approveChecked",
        data
      };
      break;
    }
    case TokenInstruction3.BurnChecked: {
      const data = decodeBurnCheckedInstruction2(instruction, instruction.programId);
      decoded = {
        name: "burnChecked",
        data
      };
      break;
    }
    case TokenInstruction3.InitializeAccount2: {
      const data = decodeInitializeAccount2Instruction2(instruction, instruction.programId);
      decoded = {
        name: "initializeAccount2",
        data
      };
      break;
    }
    case TokenInstruction3.SyncNative: {
      decoded = { name: "syncNative" };
      break;
    }
    case TokenInstruction3.InitializeAccount3: {
      const data = decodeInitializeAccount3Instruction2(instruction, instruction.programId);
      decoded = {
        name: "initializeAccount3",
        data
      };
      break;
    }
    case TokenInstruction3.InitializeMint2: {
      const data = decodeInitializeMint2Instruction2(instruction, instruction.programId);
      decoded = {
        name: "initializeMint2",
        data
      };
      break;
    }
    case TokenInstruction3.GetAccountDataSize: {
      const data = { name: "getAccountDataSize" };
      decoded = {
        name: "getAccountDataSize",
        data
      };
      break;
    }
    case TokenInstruction3.InitializeImmutableOwner: {
      const data = decodeInitializeImmutableOwnerInstruction2(instruction, instruction.programId);
      decoded = {
        name: "initializeImmutableOwner",
        data
      };
      break;
    }
    case TokenInstruction3.AmountToUiAmount: {
      const data = decodeAmountToUiAmountInstruction2(instruction, instruction.programId);
      decoded = {
        name: "amountToUiAmount",
        data
      };
      break;
    }
    case TokenInstruction3.UiAmountToAmount: {
      const data = decodeUiAmountToAmountInstruction2(instruction, instruction.programId);
      decoded = {
        name: "uiAmountToAmount",
        data
      };
      break;
    }
    case TokenInstruction3.InitializeMintCloseAuthority: {
      const data = decodeInitializeMintCloseAuthorityInstruction(instruction, instruction.programId);
      decoded = {
        name: "initializeMintCloseAuthority",
        data
      };
      break;
    }
    case TokenInstruction3.CreateNativeMint: {
      decoded = { name: "createNativeMint" };
      break;
    }
    case TokenInstruction3.TransferFeeExtension: {
      const subDiscriminator = instruction.data[1];
      switch (subDiscriminator) {
        case TransferFeeInstruction2.InitializeTransferFeeConfig: {
          const data = decodeInitializeTransferFeeConfigInstruction(instruction, instruction.programId);
          decoded = {
            name: "initializeTransferFeeConfig",
            data
          };
          break;
        }
        case TransferFeeInstruction2.TransferCheckedWithFee: {
          const data = decodeTransferCheckedWithFeeInstruction(instruction, instruction.programId);
          decoded = {
            name: "transferCheckedWithFee",
            data
          };
          break;
        }
        case TransferFeeInstruction2.WithdrawWithheldTokensFromMint: {
          const data = decodeWithdrawWithheldTokensFromMintInstruction(instruction, instruction.programId);
          decoded = {
            name: "withdrawWithheldTokensFromMint",
            data
          };
          break;
        }
        case TransferFeeInstruction2.WithdrawWithheldTokensFromAccounts: {
          const data = decodeWithdrawWithheldTokensFromAccountsInstruction(instruction, instruction.programId);
          decoded = {
            name: "withdrawWithheldTokensFromAccounts",
            data
          };
          break;
        }
        case TransferFeeInstruction2.HarvestWithheldTokensToMint: {
          const data = decodeHarvestWithheldTokensToMintInstruction(instruction, instruction.programId);
          decoded = {
            name: "harvestWithheldTokensToMint",
            data
          };
          break;
        }
        case TransferFeeInstruction2.SetTransferFee: {
          const data = decodeSetTransferFeeInstruction(instruction, instruction.programId);
          decoded = {
            name: "setTransferFee",
            data
          };
          break;
        }
        default: {
          decoded = null;
          break;
        }
      }
      break;
    }
    case TokenInstruction3.DefaultAccountStateExtension: {
      const subDiscriminator = instruction.data[1];
      switch (subDiscriminator) {
        case DefaultAccountStateInstruction.Initialize: {
          const data = defaultAccountStateInstructionData.decode(instruction.data);
          decoded = {
            name: "TokenInitialize",
            data
          };
          break;
        }
        case DefaultAccountStateInstruction.Update: {
          const data = defaultAccountStateInstructionData.decode(instruction.data);
          decoded = {
            name: "TokenUpdate",
            data
          };
          break;
        }
        default: {
          decoded = {
            name: "unknown",
            data: null
          };
          break;
        }
      }
      break;
    }
    case TokenInstruction3.MemoTransferExtension: {
      const instructionData = memoTransferInstructionData.decode(instruction.data);
      const data = instructionData;
      decoded = {
        name: "memoTransfer",
        data
      };
      break;
    }
    case TokenInstruction3.InitializeNonTransferableMint: {
      const data = { name: "initializeNonTransferableMint" };
      decoded = {
        name: "initializeNonTransferableMint",
        data
      };
      break;
    }
    case TokenInstruction3.CpiGuardExtension: {
      const instructionData = cpiGuardInstructionData.decode(instruction.data);
      decoded = {
        name: "cpiGuard",
        data: instructionData
      };
      break;
    }
    case TokenInstruction3.InitializePermanentDelegate: {
      const data = decodeInitializePermanentDelegateInstruction(instruction, instruction.programId);
      decoded = {
        name: "initializePermanentDelegate",
        data
      };
      break;
    }
    case TokenInstruction3.TransferHookExtension: {
      const subDiscriminator = instruction.data[1];
      switch (subDiscriminator) {
        case TransferHookInstruction.Initialize: {
          const data = initializeTransferHookInstructionData.decode(instruction.data);
          decoded = {
            name: "initializeTransferHook",
            data
          };
          break;
        }
        case TransferHookInstruction.Update: {
          const data = updateTransferHookInstructionData.decode(instruction.data);
          decoded = {
            name: "updateTransferHook",
            data
          };
          break;
        }
        default: {
          decoded = {
            name: "unknown",
            data: null
          };
          break;
        }
      }
      break;
    }
    case TokenInstruction3.MetadataPointerExtension: {
      const subDiscriminator = instruction.data[1];
      switch (subDiscriminator) {
        case MetadataPointerInstruction.Initialize: {
          const data = initializeMetadataPointerData.decode(instruction.data);
          decoded = {
            name: "initializeMetadataPointer",
            data
          };
          break;
        }
        case MetadataPointerInstruction.Update: {
          const data = updateMetadataPointerData.decode(instruction.data);
          decoded = {
            name: "updateMetadataPointer",
            data
          };
          break;
        }
        default: {
          decoded = {
            name: "unknown",
            data: null
          };
          break;
        }
      }
      break;
    }
    case TokenInstruction3.GroupMemberPointerExtension: {
      const discriminator2 = instruction.data[1];
      switch (discriminator2) {
        case GroupMemberPointerInstruction.Initialize: {
          const data = initializeGroupMemberPointerData.decode(instruction.data);
          decoded = {
            name: "initializeGroupMemberPointer",
            data
          };
          break;
        }
        case GroupMemberPointerInstruction.Update: {
          const data = updateGroupMemberPointerData.decode(instruction.data);
          decoded = {
            name: "updateGroupMemberPointer",
            data
          };
          break;
        }
        default: {
          const data = null;
          decoded = {
            name: "unknown",
            data
          };
          break;
        }
      }
      break;
    }
    default: {
      const discriminator2 = instruction.data.slice(0, 8).toString("hex");
      const [splDiscriminateInit, splDiscriminateUpdating, splDiscriminateRemove, splDiscriminateUpdate, splDiscriminateEmitter] = [
        "spl_token_metadata_interface:initialize_account",
        "spl_token_metadata_interface:updating_field",
        "spl_token_metadata_interface:remove_key_ix",
        "spl_token_metadata_interface:update_the_authority",
        "spl_token_metadata_interface:emitter"
      ].map((s) => splDiscriminate(s));
      switch (discriminator2) {
        case splDiscriminateInit.toString(): {
          const metadata = metadataLayout.decode(instruction.data);
          decoded = {
            name: "initializeMetadata",
            data: metadata
          };
          break;
        }
        case splDiscriminateUpdating.toString(): {
          const data = updateMetadataLayout.decode(instruction.data);
          decoded = {
            name: "updateField",
            data
          };
          break;
        }
        case splDiscriminateRemove.toString(): {
          const data = removeKeyLayout.decode(instruction.data);
          decoded = {
            name: "removeKey",
            data
          };
          break;
        }
        case splDiscriminateUpdate.toString(): {
          const data = updateAuthorityLayout.decode(instruction.data);
          decoded = {
            name: "updateAuthority",
            data
          };
          break;
        }
        case splDiscriminateEmitter.toString(): {
          const data = emitLayout.decode(instruction.data);
          decoded = {
            name: "emit",
            data
          };
          break;
        }
        default:
          decoded = {
            name: "unknown",
            data: null
          };
      }
      break;
    }
  }
  return decoded;
}

// src/parsers/parser.ts
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
var Parser = class _Parser {
  solanaDataParsers = /* @__PURE__ */ new Map();
  parseDefaultInstructions = false;
  // accountParsers: Map<string, ParserParams> = new Map();
  instructionSet = /* @__PURE__ */ new Set();
  /**
   * This parser uses the IDLs to parse the transaction and accounts data. A parser can take multiple IDLs.
   * @param programId - The PublicKey of the program.
   * @param idl - The IDL to add.
   */
  addIDL(programId, idl) {
    let parserParams = {
      programId,
      idl,
      isCoral: _Parser.isCoralIdl(idl),
      coder: null
    };
    let coder;
    let accountsMap = /* @__PURE__ */ new Map();
    let accountNames = /* @__PURE__ */ new Map();
    let eventParser;
    if (parserParams.isCoral) {
      coder = new CoralBorshCoder(idl);
      accountNames = new Map(
        idl.accounts?.map((account) => [
          account.name,
          Buffer.from(account.discriminator.map((item) => Number(item)))
        ])
      );
      idl.accounts?.forEach((account) => {
        const accountStruct = idl.types.find((t) => t.name === account.name).type.fields;
        accountsMap.set(account.name, accountStruct);
      });
      eventParser = new CoralEventParser(new PublicKey2(programId), coder);
    } else {
      coder = new SerumBorshCoder(idl);
      accountNames = new Map(
        idl.accounts?.map((account) => [
          account.name,
          SerumBorshAccountsCoder.accountDiscriminator(account.name)
        ])
      );
      idl.accounts?.forEach((account) => {
        accountsMap.set(account.name, account.type.fields);
      });
      eventParser = new SerumEventParser(new PublicKey2(programId), coder);
    }
    parserParams = {
      ...parserParams,
      coder,
      accountNames,
      accountsMap,
      eventParser
    };
    this.solanaDataParsers.set(programId.toBase58(), parserParams);
    idl.instructions.forEach((ix) => {
      this.instructionSet.add(ix.name);
    });
  }
  /**
   * Enables or disables the default System and Token instruction parsing. Disabled by default.
   * When enabled, System program, Token program, and Token 2022 program instructions will be parsed.
   * Instruction will be parsed based on the @solana/spl-token and @solana/web3 js library.
   * @param enable - Whether to enable or disable default instruction parsing.
   */
  useDefaultInstructionParsing(enable) {
    this.parseDefaultInstructions = enable;
  }
  /**
   * Checks if an IDL is a Coral IDL or not.
   * A Coral IDL is one which has an "address" field or an "instructions" field with at least one instruction with a "discriminator" field.
   * @param idl - The IDL to check.
   * @returns True if the IDL is a Coral IDL, false otherwise.
   */
  static isCoralIdl(idl) {
    return "address" in idl || "instructions" in idl && Array.isArray(idl.instructions) && idl.instructions.length > 0 && "discriminator" in idl.instructions[0];
  }
  /**
   * Returns a set of all the instructions in the IDLs combined.
   * @returns A set of all the instructions in the IDLs.
   */
  getAllInstructions() {
    return this.instructionSet;
  }
  /**
   * Retrieves the account keys from a transaction message and its associated transaction meta data.
   * The returned array will contain the static account keys from the message, as well as the loaded addresses from the meta data.
   * The loaded addresses are split into two categories: writable and readonly.
   * @param {Message|MessageV0} message - The transaction message.
   * @param {VersionedTransactionResponse["meta"]} meta - The transaction meta data.
   * @returns {string[]} An array of account keys.
   */
  getAccountKeys(message, meta) {
    let keys = message.staticAccountKeys.map((k) => k.toBase58());
    if (meta?.loadedAddresses) {
      keys = [
        ...keys,
        ...meta.loadedAddresses.writable.map((k) => k.toBase58()),
        ...meta.loadedAddresses.readonly.map((k) => k.toBase58())
      ];
    }
    return keys;
  }
  /**
   * Parses the compiled instructions in the transaction message and returns a decoded array of instructions.
   * The decoded array contains the programId, accounts, and decoded instruction data.
   * @param {MessageCompiledInstruction[]} compiledInstructions - The compiled instructions from the transaction message.
   * @param {string[]} allKeys - The list of all account keys in the transaction message.
   * @returns { { programId: string; accounts: string[]; data: any }[] } - The decoded array of instructions.
   */
  getParsedCompiledInstruction(compiledInstructions, allKeys, messageHeader, accountKeys, loadedAddresses) {
    const decoded = [];
    for (const ix of compiledInstructions) {
      const programId = allKeys[ix.programIdIndex];
      const accounts = ix.accountKeyIndexes.map((a) => allKeys[a]);
      if (this.parseDefaultInstructions) {
        const superMap = buildAccountMetaMap(accountKeys, messageHeader, loadedAddresses);
        const keys = getInstructionAccountMetas(accounts, superMap);
        if (programId === TOKEN_PROGRAM_ID2.toBase58()) {
          const decodedIx = decodeTokenInstruction({ keys, programId: TOKEN_PROGRAM_ID2, data: Buffer.from(ix.data) });
          decoded.push({
            programId,
            accounts,
            data: decodedIx ? plaintextFormatter(decodedIx) : "unknown"
          });
          continue;
        }
        if (programId === SYSTEM_PROGRAM_ID.toBase58()) {
          const keys2 = getInstructionAccountMetas(accounts, superMap);
          const decodedIx = decodeSystemInstruction({ keys: keys2, programId: SYSTEM_PROGRAM_ID, data: Buffer.from(ix.data) });
          decoded.push({
            programId,
            accounts,
            data: decodedIx ? plaintextFormatter(decodedIx) : "unknown"
          });
          continue;
        }
        if (programId === TOKEN_2022_PROGRAM_ID2.toBase58()) {
          const keys2 = getInstructionAccountMetas(accounts, superMap);
          const decodedIx = decodeToken2022Instruction({ keys: keys2, programId: TOKEN_2022_PROGRAM_ID2, data: Buffer.from(ix.data) });
          decoded.push({
            programId,
            accounts,
            data: decodedIx ? plaintextFormatter(decodedIx) : "unknown"
          });
          continue;
        }
      }
      if (!programId || !this.solanaDataParsers.has(programId)) {
        decoded.push({
          programId,
          accounts,
          data: bs58.encode(ix.data) || ix.data
        });
        continue;
      }
      const coder = this.solanaDataParsers.get(programId).coder;
      let decodedInstruction;
      try {
        decodedInstruction = plaintextFormatter(
          coder.instruction.decode(Buffer.from(ix.data))
        );
      } catch (error) {
        console.log(
          `Error decoding instruction by idl: ${ix.data} for program ${programId}`
        );
        decodedInstruction = bs58.encode(ix.data) || ix.data;
      }
      decoded.push({
        programId,
        accounts,
        data: decodedInstruction
      });
    }
    return decoded;
  }
  parseInnerInstructions(innerInstructions, allKeys, messageHeader, accountKeys, loadedAddresses) {
    if (!innerInstructions) return [];
    const decoded = [];
    for (const group of innerInstructions) {
      const { index: outerIndex, instructions } = group;
      for (const ix of instructions) {
        const programId = allKeys[ix.programIdIndex];
        const accounts = ix.accounts.map((i) => allKeys[i]);
        if (this.parseDefaultInstructions) {
          const superMap = buildAccountMetaMap(accountKeys, messageHeader, loadedAddresses);
          const keys = getInstructionAccountMetas(accounts, superMap);
          if (programId === TOKEN_PROGRAM_ID2.toBase58()) {
            const decodedIx = decodeTokenInstruction({ keys, programId: TOKEN_PROGRAM_ID2, data: bs58.decode(ix.data) });
            decoded.push({
              outerIndex,
              programId,
              accounts,
              data: decodedIx ? plaintextFormatter(decodedIx) : "unknown"
            });
            continue;
          }
          if (programId === SYSTEM_PROGRAM_ID.toBase58()) {
            const keys2 = getInstructionAccountMetas(accounts, superMap);
            const decodedIx = decodeSystemInstruction({ keys: keys2, programId: SYSTEM_PROGRAM_ID, data: bs58.decode(ix.data) });
            decoded.push({
              outerIndex,
              programId,
              accounts,
              data: decodedIx ? plaintextFormatter(decodedIx) : "unknown"
            });
            continue;
          }
          if (programId === TOKEN_2022_PROGRAM_ID2.toBase58()) {
            const keys2 = getInstructionAccountMetas(accounts, superMap);
            const decodedIx = decodeToken2022Instruction({ keys: keys2, programId: TOKEN_2022_PROGRAM_ID2, data: bs58.decode(ix.data) });
            decoded.push({
              outerIndex,
              programId,
              accounts,
              data: decodedIx ? plaintextFormatter(decodedIx) : "unknown"
            });
            continue;
          }
        }
        if (!programId || !this.solanaDataParsers.has(programId)) {
          decoded.push({
            outerIndex,
            programId,
            accounts,
            data: ix.data,
            stackHeight: ix.stackHeight
          });
          continue;
        }
        const coder = this.solanaDataParsers.get(programId).coder;
        decoded.push({
          outerIndex,
          programId,
          accounts,
          data: plaintextFormatter(coder.instruction.decode(ix.data)),
          stackHeight: ix.stackHeight
        });
      }
    }
    return decoded;
  }
  parseEvents(txn, allKeys) {
    try {
      let programIds = [];
      txn.transaction.message.compiledInstructions.forEach((ix) => {
        const programId = allKeys[ix.programIdIndex];
        if (programId) programIds.push(programId);
      });
      const inner = txn.meta?.innerInstructions;
      if (inner && Array.isArray(inner)) {
        inner.forEach((group) => {
          group.instructions.forEach((ix) => {
            const programId = allKeys[ix.programIdIndex];
            if (programId) programIds.push(programId);
          });
        });
      }
      programIds = Array.from(new Set(programIds));
      const available = Array.from(this.solanaDataParsers.keys());
      const commonProgramIds = intersection(available, programIds);
      if (!commonProgramIds.length) return [];
      const events = [];
      for (const programId of commonProgramIds) {
        const parser = this.solanaDataParsers.get(programId);
        if (!parser || !parser.eventParser) continue;
        const parsed = Array.from(
          parser.eventParser.parseLogs(txn.meta?.logMessages || [])
        );
        events.push(...parsed);
      }
      return events;
    } catch (error) {
      return [];
    }
  }
  /**
   * Parse a transaction and return a new transaction with parsed instructions and events.
   * The parsed transaction will have the following properties:
   * - transaction.message.instructions: an array of parsed compiled instructions
   * - transaction.message.events: an array of parsed events
   * - meta.innerInstructions: an array of parsed inner instructions
   *
   * @param {VersionedTransactionResponse} tx - The transaction to parse
   * @returns {VersionedTransactionResponse} - The parsed transaction
   */
  parseTransaction(tx) {
    const allKeys = this.getAccountKeys(tx.transaction.message, tx.meta);
    const parsedCompiledInstruction = this.getParsedCompiledInstruction(
      tx.transaction.message.compiledInstructions,
      allKeys,
      tx.transaction.message.header,
      tx.version === "legacy" ? tx.transaction.message.accountKeys : tx.transaction.message.staticAccountKeys,
      tx.meta?.loadedAddresses
    );
    const parsedInnerInstructions = this.parseInnerInstructions(
      tx.meta?.innerInstructions,
      allKeys,
      tx.transaction.message.header,
      tx.version === "legacy" ? tx.transaction.message.accountKeys : tx.transaction.message.staticAccountKeys,
      tx.meta?.loadedAddresses
    );
    const parsedEvents = this.parseEvents(tx, allKeys);
    if (tx.version === "legacy") {
      const txMessage2 = tx.transaction.message;
      const txWithParsed2 = {
        ...tx,
        version: "legacy",
        transaction: {
          ...tx.transaction,
          message: {
            ...txMessage2,
            accountKeys: txMessage2.accountKeys.map(
              (key) => key.toBase58()
            ),
            instructions: parsedCompiledInstruction,
            events: plaintextFormatter(parsedEvents)
          }
        },
        meta: tx.meta && {
          ...tx.meta,
          innerInstructions: parsedInnerInstructions
        }
      };
      return txWithParsed2;
    }
    const txMessage = tx.transaction.message;
    const txWithParsed = {
      ...tx,
      version: 0,
      transaction: {
        ...tx.transaction,
        message: {
          ...txMessage,
          recentBlockhash: utils.bytes.bs58.encode(
            Buffer.from(txMessage.recentBlockhash)
          ),
          staticAccountKeys: txMessage.staticAccountKeys.map(
            (key) => key.toBase58()
          ),
          compiledInstructions: parsedCompiledInstruction,
          events: plaintextFormatter(parsedEvents)
        }
      },
      meta: tx.meta && {
        ...tx.meta,
        innerInstructions: parsedInnerInstructions
      }
    };
    return txWithParsed;
  }
  /**
   * Convert a transaction message to a VersionedMessage.
   * If the message is legacy, it will be converted to a VersionedMessage with the following properties:
   * - header: the header of the message
   * - recentBlockhash: the recent block hash of the message
   * - accountKeys: an array of account public keys
   * - instructions: an array of parsed compiled instructions
   * If the message is not legacy, it will be converted to a VersionedMessage with the following properties:
   * - header: the header of the message
   * - recentBlockhash: the recent block hash of the message
   * - staticAccountKeys: an array of account public keys
   * - compiledInstructions: an array of parsed compiled instructions
   * - addressTableLookups: an array of address table lookups
   * @param {any} message - The transaction message to convert
   * @returns {VersionedMessage} - The converted transaction message
   */
  formTxnMessage(message) {
    if (!message.versioned) {
      return new Message({
        header: {
          numRequiredSignatures: message.header.numRequiredSignatures,
          numReadonlySignedAccounts: message.header.numReadonlySignedAccounts,
          numReadonlyUnsignedAccounts: message.header.numReadonlyUnsignedAccounts
        },
        recentBlockhash: utils.bytes.bs58.encode(
          Buffer.from(message.recentBlockhash, "base64")
        ),
        accountKeys: message.accountKeys?.map(
          (d) => Buffer.from(d, "base64")
        ),
        instructions: message.instructions.map(
          ({
            data,
            programIdIndex,
            accounts
          }) => ({
            programIdIndex,
            accounts: Array.from(accounts),
            data: utils.bytes.bs58.encode(Buffer.from(data || "", "base64"))
          })
        )
      });
    } else {
      return new MessageV0({
        header: {
          numRequiredSignatures: message.header.numRequiredSignatures,
          numReadonlySignedAccounts: message.header.numReadonlySignedAccounts,
          numReadonlyUnsignedAccounts: message.header.numReadonlyUnsignedAccounts
        },
        recentBlockhash: utils.bytes.bs58.encode(
          Buffer.from(message.recentBlockhash, "base64")
        ),
        staticAccountKeys: message.accountKeys.map(
          (k) => new PublicKey2(Buffer.from(k, "base64"))
        ),
        compiledInstructions: message.instructions.map(
          ({
            programIdIndex,
            accounts,
            data
          }) => ({
            programIdIndex,
            accountKeyIndexes: Array.from(accounts),
            data: Uint8Array.from(Buffer.from(data || "", "base64"))
          })
        ),
        addressTableLookups: message.addressTableLookups?.map(
          ({
            accountKey,
            writableIndexes,
            readonlyIndexes
          }) => ({
            writableIndexes: writableIndexes || [],
            readonlyIndexes: readonlyIndexes || [],
            accountKey: new PublicKey2(Buffer.from(accountKey, "base64"))
          })
        ) || []
      });
    }
  }
  /**
   * Formats a transaction object returned from the gRPC API into a VersionedTransactionResponse object.
   * @param data - The transaction object returned from the gRPC API.
   * @param time - The block time of the transaction.
   * @returns A VersionedTransactionResponse object.
   */
  formatGrpcTransactionData(data, time) {
    const rawTx = data["transaction"];
    const slot = data.slot;
    const version = rawTx.transaction.message.versioned ? 0 : "legacy";
    const meta = this.formMeta(rawTx.meta);
    const signatures = rawTx.transaction.signatures.map(
      (s) => utils.bytes.bs58.encode(s)
    );
    const message = this.formTxnMessage(rawTx.transaction.message);
    return {
      slot,
      version,
      blockTime: time,
      meta,
      transaction: {
        signatures,
        message
      }
    };
  }
  formMeta(meta) {
    return {
      err: meta.errorInfo ? { err: meta.errorInfo } : null,
      fee: meta.fee,
      preBalances: meta.preBalances,
      postBalances: meta.postBalances,
      preTokenBalances: meta.preTokenBalances || [],
      postTokenBalances: meta.postTokenBalances || [],
      logMessages: meta.logMessages || [],
      loadedAddresses: meta.loadedWritableAddresses || meta.loadedReadonlyAddresses ? {
        writable: meta.loadedWritableAddresses?.map(
          (address) => new PublicKey2(address)
        ) || [],
        readonly: meta.loadedReadonlyAddresses?.map(
          (address) => new PublicKey2(address)
        ) || []
      } : void 0,
      innerInstructions: meta.innerInstructions?.map(
        (i) => ({
          index: i.index || 0,
          instructions: i.instructions.map((instruction) => ({
            programIdIndex: instruction.programIdIndex,
            accounts: Array.from(instruction.accounts),
            data: utils.bytes.bs58.encode(
              Buffer.from(instruction.data || "", "base64")
            )
          }))
        })
      ) || []
    };
  }
  getAccountName(data, accountNames) {
    const discriminator = data.subarray(0, 8);
    let account = "";
    accountNames.forEach((accountDiscriminator, accountName) => {
      if (this.arraysEqual(discriminator, accountDiscriminator)) {
        account = accountName;
      }
    });
    if (!account) {
      throw new Error(
        `[ ${(/* @__PURE__ */ new Date()).toISOString()}} ] Account discriminator not found`
      );
    }
    return account;
  }
  arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  decodeAccountData(data, parser) {
    const accountNameByDiscriminator = this.getAccountName(
      data,
      parser.accountNames
    );
    const parsedData = parser.coder.accounts.decodeAny(data);
    const accountFields = parser.accountsMap.get(accountNameByDiscriminator);
    if (!accountFields) {
      throw new Error(
        `No account found with name ${accountNameByDiscriminator} for program ${parser.programId}`
      );
    }
    return {
      accountName: accountNameByDiscriminator,
      parsed: serializeStruct(parsedData, accountFields, parser.idl.types)
    };
  }
  /**
   * Parse the account data.
   * @param {AccountInfo} data - The data of the account to parse.
   * @returns {object} - The parsed account data.
   * @throws {Error} - If the account parser is not found for the account owner.
   */
  parseAccount(data) {
    if (!this.solanaDataParsers.has(data.owner.toBase58())) {
      throw new Error(`Account parser not found for ${data.owner.toBase58()}`);
    }
    const parser = this.solanaDataParsers.get(data.owner.toString());
    const parsedData = this.decodeAccountData(data.data, parser);
    return {
      data: data.data,
      parsed: parsedData,
      pubkey: data.pubkey.toBase58(),
      lamports: data.lamports,
      owner: data.owner.toBase58(),
      executable: data.executable,
      rentEpoch: data.rentEpoch,
      slot: data.slot
    };
  }
  /**
   * Data received from gRPC is slightly different from AccountInfo. This function formats a GeyserAccountType (gRPC Received Data)
   * object into an AccountInfo object.
   * @param {GeyserAccountType} geyserAcc - The GeyserAccountType object to format.
   * @returns {AccountInfo} - The formatted AccountInfo object.
   */
  formatGeyserAccountData(geyserAcc) {
    return {
      slot: Number(geyserAcc.slot),
      pubkey: new PublicKey2(geyserAcc.account.pubkey),
      lamports: Number(geyserAcc.account.lamports),
      owner: new PublicKey2(geyserAcc.account.owner),
      data: geyserAcc.account.data,
      executable: geyserAcc.account.executable,
      rentEpoch: Number(geyserAcc.account.rentEpoch)
    };
  }
};
export {
  AccountStreamer,
  Parser,
  TransactionStreamer
};
