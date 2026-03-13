// ========== Move Package Constants ==========
// Updated after each deployment. These are placeholder values for development.

export const MOVE_PACKAGE = {
  /** Replace after deployment to testnet/mainnet */
  PACKAGE_ID: "0x0",

  // Module names (must match the module declarations in .move files)
  MODULES: {
    TYPES: "types",
    ERRORS: "errors",
    EVENTS: "events",
    ADMIN: "admin",
    POOL: "pool",
    DATAROOM: "dataroom",
    DOCUMENT: "document",
    IC_DECISION: "ic_decision",
    POOL_ENTRY: "pool_entry",
    DATAROOM_ENTRY: "dataroom_entry",
    DOCUMENT_ENTRY: "document_entry",
    SEAL_POLICY: "seal_policy",
  },

  // Entry function names
  FUNCTIONS: {
    CREATE_POOL: "create_pool",
    TRANSITION_STATE: "transition_state",
    CANCEL_POOL: "cancel_pool",
    ADD_MEMBER: "add_member",
    REMOVE_MEMBER: "remove_member",
    UPDATE_MEMBER_ROLE: "update_member_role",
    CREATE_CUSTOM_FOLDER: "create_custom_folder",
    CREATE_DOCUMENT: "create_document",
    ADD_VERSION: "add_version",
    SUBMIT_REVIEW: "submit_review",
    ARCHIVE_DOCUMENT: "archive_document",
    SUBMIT_IC_DECISION: "submit_ic_decision",
    STORE_FOLDER_KEY: "store_folder_key",
    SET_REQUIRED_FLAG: "set_required_flag",
    TOGGLE_PAUSE: "toggle_pause",
  },

  // Object type names (for SuiClient queries)
  OBJECT_TYPES: {
    POOL: "Pool",
    ADMIN_CONFIG: "AdminConfig",
  },
} as const;
