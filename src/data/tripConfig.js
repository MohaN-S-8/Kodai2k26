export const COMMON_COSTS = [
  {
    label: "Van Total",
    value: "46000",
    note: "Common trip van amount",
  },
  {
    label: "Room Total",
    value: "11000",
    note: "Common stay amount",
  },
  {
    label: "Camera Total",
    value: "1950",
    note: "Already added to whoever pays it",
  },
  {
    label: "Food",
    value: "~1500",
    note: "Per person for 2 days",
  },
  {
    label: "Entry Fee",
    value: "~500",
    note: "Per person",
  },
];

export const BALANCE_COLUMN = "Balance Amount From per Person Without food";

export const COLUMN_LABELS = {
  No: "No",
  Name: "Name",
  "Total Share": "Total Share",
  "Total given": "Total Given",
  "Entry fee ~ 500": "Entry Fee ~ 500",
  [BALANCE_COLUMN]: "Balance Without Food",
};

export const MONEY_COLUMNS = new Set([
  "Total Share",
  "Total given",
  "Entry fee ~ 500",
  BALANCE_COLUMN,
]);

export const PREFERRED_COLUMNS = [
  "No",
  "Name",
  "Total Share",
  "Total given",
  "Entry fee ~ 500",
  BALANCE_COLUMN,
];
