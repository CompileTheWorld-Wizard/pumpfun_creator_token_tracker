import { ConfirmedTransactionMeta, PublicKey, VersionedTransactionResponse, VersionedMessage } from '@solana/web3.js';
import { Idl, BorshCoder, EventParser } from '@coral-xyz/anchor';
import { Idl as Idl$1, BorshCoder as BorshCoder$1, EventParser as EventParser$1 } from '@project-serum/anchor';
import { IdlField } from '@coral-xyz/anchor/dist/cjs/idl';
import { IdlField as IdlField$1 } from '@project-serum/anchor/dist/cjs/idl';

type ReadableLegacyTransactionResponse = {
    slot: string | number;
    version: "legacy";
    blockTime?: number | null;
    transaction: {
        signatures: string[];
        message: ReadableLegacyMessage;
    };
    meta: ReadableTransactionMeta | null;
};
type ReadableLegacyMessage = {
    header: {
        numRequiredSignatures: number;
        numReadonlySignedAccounts: number;
        numReadonlyUnsignedAccounts: number;
    };
    accountKeys: string[];
    recentBlockhash: string;
    instructions: ReadableCompiledInstruction[];
    indexToProgramIds?: Record<string, string>;
    events?: ReadableEvent[];
};
type ReadableV0TransactionResponse = {
    slot: string | number;
    version: 0;
    blockTime?: number | null;
    transaction: {
        signatures: string[];
        message: ReadableV0Message;
    };
    meta: ReadableTransactionMeta | null;
};
type ReadableV0Message = {
    header: {
        numRequiredSignatures: number;
        numReadonlySignedAccounts: number;
        numReadonlyUnsignedAccounts: number;
    };
    staticAccountKeys: string[];
    recentBlockhash: string;
    compiledInstructions: ReadableCompiledInstruction[];
    addressTableLookups: any[];
    events?: ReadableEvent[];
};
type ReadableCompiledInstruction = {
    programId: string;
    accounts: string[];
    data: any;
};
type ReadableEvent = {
    name: string;
    data: Record<string, any>;
};
type ReadableTransactionMeta = Omit<ConfirmedTransactionMeta, "innerInstructions"> & {
    innerInstructions?: {
        programId: string;
        accounts: string[];
        data: any;
    }[];
};

type AnyIdl = Idl | Idl$1;
type GeyserAccountType = {
    account: {
        pubkey: PublicKey;
        lamports: string;
        owner: PublicKey;
        data: Buffer;
        executable: boolean;
        rentEpoch: string;
        writeVersion: string;
        txnSignature: Buffer;
    };
    slot: string;
    isStartup?: boolean;
};
type AccountInfo = {
    slot: number;
    pubkey: PublicKey;
    lamports: number;
    owner: PublicKey;
    data: any;
    executable: boolean;
    rentEpoch?: number;
};
type ParserParams = {
    programId: string;
    idl: Idl | Idl$1;
    isCoral: boolean;
    coder: BorshCoder | BorshCoder$1;
    accountsMap: Map<string, IdlField[] | IdlField$1[]>;
    accountNames: Map<string, Buffer>;
    eventParser?: EventParser | EventParser$1;
};
declare class Parser {
    private solanaDataParsers;
    private parseDefaultInstructions;
    private instructionSet;
    /**
     * This parser uses the IDLs to parse the transaction and accounts data. A parser can take multiple IDLs.
     * @param programId - The PublicKey of the program.
     * @param idl - The IDL to add.
     */
    addIDL(programId: PublicKey, idl: Idl | Idl$1): void;
    /**
     * Enables or disables the default System and Token instruction parsing. Disabled by default.
     * When enabled, System program, Token program, and Token 2022 program instructions will be parsed.
     * Instruction will be parsed based on the @solana/spl-token and @solana/web3 js library.
     * @param enable - Whether to enable or disable default instruction parsing.
     */
    useDefaultInstructionParsing(enable: boolean): void;
    /**
     * Checks if an IDL is a Coral IDL or not.
     * A Coral IDL is one which has an "address" field or an "instructions" field with at least one instruction with a "discriminator" field.
     * @param idl - The IDL to check.
     * @returns True if the IDL is a Coral IDL, false otherwise.
     */
    static isCoralIdl(idl: AnyIdl): idl is Idl;
    /**
     * Returns a set of all the instructions in the IDLs combined.
     * @returns A set of all the instructions in the IDLs.
     */
    getAllInstructions(): Set<string>;
    /**
     * Retrieves the account keys from a transaction message and its associated transaction meta data.
     * The returned array will contain the static account keys from the message, as well as the loaded addresses from the meta data.
     * The loaded addresses are split into two categories: writable and readonly.
     * @param {Message|MessageV0} message - The transaction message.
     * @param {VersionedTransactionResponse["meta"]} meta - The transaction meta data.
     * @returns {string[]} An array of account keys.
     */
    private getAccountKeys;
    /**
     * Parses the compiled instructions in the transaction message and returns a decoded array of instructions.
     * The decoded array contains the programId, accounts, and decoded instruction data.
     * @param {MessageCompiledInstruction[]} compiledInstructions - The compiled instructions from the transaction message.
     * @param {string[]} allKeys - The list of all account keys in the transaction message.
     * @returns { { programId: string; accounts: string[]; data: any }[] } - The decoded array of instructions.
     */
    private getParsedCompiledInstruction;
    private parseInnerInstructions;
    private parseEvents;
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
    parseTransaction(tx: VersionedTransactionResponse): ReadableLegacyTransactionResponse | ReadableV0TransactionResponse;
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
    formTxnMessage(message: any): VersionedMessage;
    /**
     * Formats a transaction object returned from the gRPC API into a VersionedTransactionResponse object.
     * @param data - The transaction object returned from the gRPC API.
     * @param time - The block time of the transaction.
     * @returns A VersionedTransactionResponse object.
     */
    formatGrpcTransactionData(data: any, time: number): VersionedTransactionResponse;
    private formMeta;
    private getAccountName;
    private arraysEqual;
    private decodeAccountData;
    /**
     * Parse the account data.
     * @param {AccountInfo} data - The data of the account to parse.
     * @returns {object} - The parsed account data.
     * @throws {Error} - If the account parser is not found for the account owner.
     */
    parseAccount(data: AccountInfo): {
        data: any;
        parsed: {
            accountName: string;
            parsed: any;
        };
        pubkey: string;
        lamports: number;
        owner: string;
        executable: boolean;
        rentEpoch: number | undefined;
        slot: number;
    };
    /**
     * Data received from gRPC is slightly different from AccountInfo. This function formats a GeyserAccountType (gRPC Received Data)
     * object into an AccountInfo object.
     * @param {GeyserAccountType} geyserAcc - The GeyserAccountType object to format.
     * @returns {AccountInfo} - The formatted AccountInfo object.
     */
    formatGeyserAccountData(geyserAcc: GeyserAccountType): AccountInfo;
}

declare class TransactionStreamer {
    private client;
    private request;
    private addresses;
    private running;
    private stream?;
    private parser;
    private idlInstructionNames;
    private onInstructionCallbacks;
    private onDataCallback?;
    private onErrorCallback?;
    private onEndCallback?;
    private onCloseCallback?;
    /**
     * Initializes the TransactionStreamer, which can be used to stream transactions and parse them using the provided parser
     * @param endpoint Accepts your Yellowstone gRPC Connection URL
     * @param xToken Accepts your X-token, which is used for authentication
     */
    constructor(endpoint: string, xToken?: string);
    /**
    * Registers a callback to be triggered when a specific instruction is detected in a transaction.
    * @param instructionName The instruction name (must exist in IDL)
    * @param callback The function to invoke when that instruction appears in a transaction
    */
    onDetectInstruction(instructionName: string, callback: (tx: any) => void): void;
    /**
     * Sets a callback function to be called when a transaction is received.
     * The callback function takes a single parameter, which is the transaction data.
     * @param callback The callback function to call when a transaction is received.
     */
    onData(callback: (data: any) => void): void;
    /**
     * Sets a callback function to be called when an error occurs while streaming transactions.
     * The callback function takes one argument, which is the error that occurred.
     * @param callback The callback function to call when an error occurs
     */
    onError(callback: (error: any) => void): void;
    /**
     * Fired when the stream has ended.
     * @param callback Accepts a callback function, which takes no arguments
     */
    onEnd(callback: () => void): void;
    /**
     * Sets a callback function to be called when the stream has been closed.
     * This is called after the stream has been ended and the stream is no longer available.
     * @param callback The callback function to call when the stream has been closed.
     */
    onClose(callback: () => void): void;
    private updateRequest;
    private pushUpdate;
    /**
     * Adds a list of addresses to the transaction stream request.
     * Transactions from these addresses will be included in the transaction stream.
     * @param newAddresses The list of addresses to add to the transaction stream request.
    */
    addAddresses(newAddresses: string[]): Promise<void>;
    /**
     * Removes a list of addresses from the transaction stream request.
     * Transactions from these addresses will no longer be included in the transaction stream.
     * @param removeList The list of addresses to remove from the transaction stream request.
     */
    removeAddresses(removeList: string[]): Promise<void>;
    /**
     * Adds a parser, which is created using the Parser class, to the transaction streamer. The parser is used to parse the transactions and accounts data received from the stream.
     * @param parser The parser to add to the transaction streamer.
     */
    addParser(parser: Parser): Promise<void>;
    /**
     * Starts the transaction stream, which will keep running until stop is called.
     * The stream will retry indefinitely if an error occurs, with a maximum delay of 30s.
     * The delay between retries will double each time an error occurs, up to a maximum of 30s.
     */
    start(): Promise<void>;
    /**
     * Stops the transaction stream if it is currently running.
     * This will prevent any further transactions from being received until
     * `start` is called again.
     */
    stop(): void;
    private handleStream;
    /**
     * Detects which IDL instruction(s) are present in the transaction and calls the corresponding callbacks.
     * @param tx The transaction data.
     */
    private detectInstructionType;
}

declare class AccountStreamer {
    private client;
    private request;
    private addresses;
    private owners;
    private running;
    private stream?;
    private onDataCallback?;
    private onErrorCallback?;
    private onEndCallback?;
    private onCloseCallback?;
    private parser;
    /**
     * Initializes the AccountStreamer, which can be used to stream account data and parse it using the provided parser
     * @param endpoint Accepts your Yellowstone gRPC Connection URL
     * @param xToken Accepts your X-token, which is used for authentication
     */
    constructor(endpoint: string, xToken?: string);
    /**
     * Sets a callback function to be called when account data is received.
     * The callback function takes a single parameter, which is the account data.
     * @param callback The callback function to call when account data is received.
     */
    onData(callback: (data: any) => void): void;
    /**
     * Sets a callback function to be called when an error occurs while streaming account data.
     * The callback function takes a single parameter, which is the error that occurred.
     * @param callback The callback function to call when an error occurs
     */
    onError(callback: (err: any) => void): void;
    /**
     * Fired when the stream has ended. This is called after the stream has been ended and the stream is no longer available.
     * @param callback Accepts a callback function, which takes no arguments
     */
    onEnd(callback: () => void): void;
    /**
     * Sets a callback function to be called when the stream has been closed.
     * This is called after the stream has been ended and the stream is no longer available.
     * @param callback Accepts a callback function, which takes no arguments
     */
    onClose(callback: () => void): void;
    private updateRequest;
    private pushUpdate;
    /**
     * Adds a list of addresses to the account stream request.
     * Accounts from these addresses will be included in the account stream.
     * @param newAddresses The list of addresses to add to the account stream request.
     */
    addAddresses(newAddresses: string[]): Promise<void>;
    /**
     * Removes a list of addresses from the account stream request.
     * Accounts from these addresses will no longer be included in the account stream.
     * @param removeList The list of addresses to remove from the account stream request.
     */
    removeAddresses(removeList: string[]): Promise<void>;
    /**
     * Adds a list of addresses to the account stream request as owners.
     * Accounts for which these addresses are owners will be included in the account stream.
     * @param newOwners The list of addresses to add to the account stream request as owners.
     */
    addOwners(newOwners: string[]): Promise<void>;
    /**
     * Removes a list of addresses from the account stream request as owners.
     * Accounts for which these addresses are no longer owners will no longer be included in the account stream.
     * @param removeList The list of addresses to remove from the account stream request as owners.
     */
    removeOwners(removeList: string[]): Promise<void>;
    addParser(parser: Parser): Promise<void>;
    /**
     * Starts the account stream, which will keep running until stop is called.
     * The stream will retry indefinitely if an error occurs, with a maximum delay of 30s.
     * The delay between retries will double each time an error occurs, up to a maximum of 30s.
     */
    start(): Promise<void>;
    /**
     * Stops the account stream if it is currently running.
     * This will prevent any further accounts from being received until
     * `start` is called again.
     */
    stop(): void;
    private handleStream;
}

export { type AccountInfo, AccountStreamer, type GeyserAccountType, Parser, type ParserParams, TransactionStreamer };
