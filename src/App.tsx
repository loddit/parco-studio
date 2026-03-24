import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { DatasetListPage } from "@/features/datasets/DatasetListPage";

const DatasetEditorPage = lazy(() =>
  import("@/features/editor/DatasetEditorPage").then((module) => ({
    default: module.DatasetEditorPage,
  })),
);

export function App() {
  return (
    <Suspense
      fallback={
        <main className="app-shell flex min-h-screen items-center justify-center px-4">
          <div className="panel max-w-lg p-8 text-center">
            <p className="text-lg font-semibold text-slate-950">Loading editor...</p>
          </div>
        </main>
      }
    >
      <Routes>
        <Route path="/" element={<DatasetListPage />} />
        <Route path="/datasets/:datasetId" element={<DatasetEditorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
