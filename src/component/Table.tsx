import React from "react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community"; // ✅ import type
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { FaRegCopy } from "react-icons/fa";

// Register ag-Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface TableProps {
  rowData: any[];
}

const Table: React.FC<TableProps> = ({ rowData }) => {
  const STORAGE_KEY = "symbolNotes";
  const [symbolNotes, setSymbolNotes] = React.useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const symbolNotesRef = React.useRef(symbolNotes);
  React.useEffect(() => {
    symbolNotesRef.current = symbolNotes;
  }, [symbolNotes]);

  const saveSymbolNote = React.useCallback((symbol: string, note: string) => {
    setSymbolNotes((prev) => {
      const next = { ...prev, [symbol]: note };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text.toString());
      console.log("Copied to clipboard:", text);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  const CellWithCopyIcon = (props: any) => {
    const { value } = props;
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "100%", padding: "0px 4px" }}>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard(value);
          }}
          style={{
            marginLeft: "8px",
            padding: "4px",
            fontSize: "12px",
            border: "none",
            borderRadius: "3px",
            backgroundColor: "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Copy to clipboard"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#3F231B";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <FaRegCopy />
        </button>
      </div>
    );
  };

  // ✅ typed columnDefs
  const [colDefs] = React.useState<ColDef[]>([
    {
      headerName: "No",
      headerStyle: { fontWeight: "bold", textAlign: "center" },
      valueGetter: (params: any) => params.node.rowIndex + 1,
      maxWidth: 70,
      pinned: "left", // ✅ now valid
      cellStyle: { textAlign: "center", fontWeight: "bold", backgroundColor: "#F8FAFD" },
    },
    { field: "coldkey", cellRenderer: CellWithCopyIcon, minWidth: 150, maxWidth: 520 },
    { field: "hotkey", cellRenderer: CellWithCopyIcon, minWidth: 150, maxWidth: 520 },
    {
      headerName: "Symbol Notes",
      editable: true,
      minWidth: 200,
      valueGetter: (params: any) => {
        const sym = params.data?.symbol;
        if (!sym) return "";
        return symbolNotesRef.current[sym] ?? "";
      },
      valueSetter: (params: any) => {
        const sym = params.data?.symbol;
        if (!sym) return false;
        saveSymbolNote(sym, params.newValue ?? "");
        // prevent grid from trying to set on rowData
        return false;
      },
      cellStyle: { backgroundColor: "#FFFDF5" },
    },
    { field: "UID", maxWidth: 90 },
    { field: "Ranking", maxWidth: 90 },
    { field: "Staking", maxWidth: 90 },
    { field: "DailyAlpha", maxWidth: 90 },
    { field: "Immune", maxWidth: 90 },
    { field: "Registered", maxWidth: 100 },
    { field: "In Danger", maxWidth: 100 },
    { field: "Deregistered", maxWidth: 100 },
  ]);

  // ✅ typed default col def
  const defaultColDef: ColDef = {
    flex: 1,
    minWidth: 100,
    resizable: true,
    filter: true,
    floatingFilter: true,
  };

  return (
    <div className="ag-theme-alpine" style={{ width: "100%", height: 800 }}>
      <AgGridReact rowData={rowData} columnDefs={colDefs} defaultColDef={defaultColDef} />
    </div>
  );
};

export default Table;
