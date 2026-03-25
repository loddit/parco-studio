import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import {
  createDataset,
  deleteDataset,
  listDatasets,
  updateDataset,
} from "@/lib/datasets-db";
import { formatDateTime } from "@/lib/utils";
import type { Dataset } from "@/types/dataset";

export function DatasetListPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [newDatasetName, setNewDatasetName] = useState("");
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void reloadDatasets();
  }, []);

  async function reloadDatasets() {
    const nextDatasets = await listDatasets();
    setDatasets(nextDatasets);
  }

  async function handleCreateDataset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = newDatasetName.trim();

    if (!value) {
      return;
    }

    setIsBusy(true);

    try {
      await createDataset(value);
      setNewDatasetName("");
      await reloadDatasets();
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRenameDataset(id: string) {
    const value = editingName.trim();

    if (!value) {
      return;
    }

    setIsBusy(true);

    try {
      await updateDataset(id, { name: value });
      setEditingDatasetId(null);
      setEditingName("");
      await reloadDatasets();
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteDataset(id: string) {
    setIsBusy(true);

    try {
      await deleteDataset(id);
      await reloadDatasets();
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="app-shell px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col gap-6">
        <section className="panel overflow-hidden">
          <div className="soft-grid flex flex-col gap-8 px-6 py-8 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-10">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-600">
                Parco Studio
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                GeoJSON datasets, staged locally.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                Root route shows every dataset stored in IndexedDB and keeps the editor workflow
                one click away.
              </p>
            </div>

            <form className="w-full max-w-md space-y-3" onSubmit={handleCreateDataset}>
              <label className="block text-sm font-medium text-slate-700" htmlFor="dataset-name">
                New dataset
              </label>
              <div className="flex gap-3">
                <TextInput
                  id="dataset-name"
                  placeholder="Neighborhood boundaries"
                  value={newDatasetName}
                  onChange={(event) => setNewDatasetName(event.target.value)}
                />
                <Button disabled={isBusy || !newDatasetName.trim()} type="submit">
                  Create
                </Button>
              </div>
            </form>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {datasets.map((dataset) => {
            const isEditing = editingDatasetId === dataset.id;

            return (
              <article className="panel p-5" key={dataset.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="space-y-3">
                        <TextInput
                          autoFocus
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            disabled={!editingName.trim() || isBusy}
                            onClick={() => void handleRenameDataset(dataset.id)}
                            variant="secondary"
                          >
                            Save
                          </Button>
                          <Button
                            onClick={() => {
                              setEditingDatasetId(null);
                              setEditingName("");
                            }}
                            variant="ghost"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2 className="truncate text-xl font-semibold text-slate-950">
                          {dataset.name}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Updated {formatDateTime(dataset.updatedAt)}
                        </p>
                      </>
                    )}
                  </div>

                  {!isEditing ? (
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                      Local
                    </span>
                  ) : null}
                </div>

                {!isEditing ? (
                  <>
                    <div className="mt-6 flex flex-wrap gap-2">
                      <Link
                        className="bg-sky-200 inline-flex items-center justify-center rounded-full px-3.5 py-2 text-[13px] font-semibold transition"
                        to={`/datasets/${dataset.id}`}
                      >
                        Open
                      </Link>
                      <Button
                        className="px-3"
                        onClick={() => {
                          setEditingDatasetId(dataset.id);
                          setEditingName(dataset.name);
                        }}
                        variant="secondary"
                      >
                        Edit
                      </Button>
                      <Button
                        className="px-3"
                        onClick={() => void handleDeleteDataset(dataset.id)}
                        variant="ghost"
                      >
                        Delete
                      </Button>
                    </div>
                  </>
                ) : null}
              </article>
            );
          })}

          {datasets.length === 0 ? (
            <div className="panel col-span-full p-10 text-center">
              <p className="text-lg font-semibold text-slate-900">No datasets yet</p>
              <p className="mt-2 text-slate-600">
                Create the first dataset to initialize the editor workflow in IndexedDB.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
