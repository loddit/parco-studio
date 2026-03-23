import { Navigate, Route, Routes } from "react-router-dom";
import { DatasetListPage } from "@/features/datasets/DatasetListPage";
import { DatasetEditorPage } from "@/features/editor/DatasetEditorPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<DatasetListPage />} />
      <Route path="/datasets/:datasetId" element={<DatasetEditorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
