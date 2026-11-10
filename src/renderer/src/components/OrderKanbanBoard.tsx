import { Icon } from '@iconify/react'
import { useEffect, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import type { OrderFolderImage, OrderFolderInfo } from '../env'
import {
  dropMarkerRect,
  hitTestColumnDrop,
  hitTestListDrop,
  rowDropMarkerRect,
  type ColumnDropTarget
} from '../lib/column-drag'
import { writeSequenceDrag } from '../lib/sequence-drag'
import type { OrderLibraryView, OrderThumbSize } from './OrderBlockRibbon'
import { AdwAlertDialog } from './AdwAlertDialog'
import { AdwContextMenu, AdwContextMenuItem } from './AdwContextMenu'
import { AdwTooltip, orderFolderPath } from './AdwTooltip'
import { AppIcons, toolbarIconSize } from './icons'

export type FolderWithImages = {
  folder: OrderFolderInfo
  images: OrderFolderImage[]
}

type ColumnDragState = {
  folderName: string
  pointerId: number
  offsetX: number
  offsetY: number
  width: number
  height: number
  x: number
  y: number
  dropTarget: ColumnDropTarget | null
}

type OrderKanbanBoardProps = {
  folders: OrderFolderInfo[]
  orderImagesPath: string
  activeFolderName: string | null
  activeImagePath: string | null
  onSelectFolder: (name: string) => void
  onSelectImage: (folderName: string, path: string) => void
  onReorderFolders: (
    fromName: string,
    targetName: string,
    position: 'before' | 'after'
  ) => void
  view: OrderLibraryView
  thumbSize: OrderThumbSize
  showImageNames: boolean
  onNewFolder: () => void
  onImportImages: (folderName: string) => Promise<void>
}

function dragOrderImage(event: DragEvent<HTMLButtonElement>, folder: string, image: OrderFolderImage): void {
  writeSequenceDrag(event.dataTransfer, {
    op: 'insert',
    draft: { kind: 'order-image', folder, path: image.path, name: image.name }
  })
}

function pathToFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+/g, '/')
  return `file:///${normalized.replace(/^\//, '')}`
}

function OrderBrowser({
  view,
  loading,
  folderData,
  activeFolderName,
  activeImagePath,
  onSelectFolder,
  onSelectImage,
  thumbSize,
  showImageNames,
  onNewFolder,
  onImportImages,
  folderRefs,
  onReorderPointerDown,
  shouldIgnoreFolderClick,
  onImageMenu
}: {
  view: OrderLibraryView
  loading: boolean
  folderData: FolderWithImages[]
  activeFolderName: string | null
  activeImagePath: string | null
  onSelectFolder: (name: string) => void
  onSelectImage: (folderName: string, path: string) => void
  thumbSize: OrderThumbSize
  showImageNames: boolean
  onNewFolder: () => void
  onImportImages: (folderName: string) => Promise<void>
  folderRefs: Map<string, HTMLElement>
  onReorderPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, name: string) => void
  shouldIgnoreFolderClick: () => boolean
  onImageMenu: (event: ReactMouseEvent, folderName: string, image: OrderFolderImage) => void
}): ReactElement {
  const active = folderData.find(({ folder }) => folder.name === activeFolderName) ?? null
  const [importing, setImporting] = useState(false)

  async function importImages(): Promise<void> {
    if (!activeFolderName || importing) return
    setImporting(true)
    try {
      await onImportImages(activeFolderName)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="order-browser">
      <div className="order-browser__folders" role="navigation" aria-label="Folders">
        {folderData.length === 0 && !loading ? (
          <div className="order-browser__empty">
            <p className="adw-caption">No folders</p>
            <button type="button" className="adw-button adw-button--suggested" onClick={onNewFolder}>
              New folder
            </button>
          </div>
        ) : (
          <ul className="order-folder-list">
            {folderData.map(({ folder, images }) => {
              const selected = folder.name === activeFolderName
              return (
                <li
                  key={folder.name}
                  className="order-folder-list__row"
                  ref={(el) => {
                    if (el) folderRefs.set(folder.name, el)
                    else folderRefs.delete(folder.name)
                  }}
                >
                  <button
                    type="button"
                    className={selected ? 'order-folder-list__item order-folder-list__item--selected' : 'order-folder-list__item'}
                    onPointerDown={(event) => onReorderPointerDown(event, folder.name)}
                    onClick={() => {
                      if (shouldIgnoreFolderClick()) return
                      onSelectFolder(folder.name)
                    }}
                  >
                    <span className="order-folder-list__name">{folder.name}</span>
                    <span className="order-folder-list__count adw-caption">{images.length}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className="order-browser__images">
        {loading ? (
          <p className="adw-caption order-browser__status">Loading images…</p>
        ) : !active ? (
          <p className="adw-caption order-browser__status">Select a folder</p>
        ) : active.images.length === 0 ? (
          <div className="order-browser__status-page">
            <Icon icon={AppIcons.images} width={32} height={32} />
            <p className="order-browser__status-title">No images</p>
            <p className="adw-caption">This folder is empty.</p>
            <button
              type="button"
              className="adw-button adw-button--suggested"
              disabled={importing}
              onClick={() => void importImages()}
            >
              Import images
            </button>
          </div>
        ) : view === 'grid' ? (
          <ul className={`order-image-grid order-image-grid--${thumbSize}`}>
            {active.images.map((image) => {
              const selected = image.path === activeImagePath
              return (
                <li key={image.path}>
                  <button
                    type="button"
                    className={selected ? 'order-image-grid__item order-image-grid__item--selected' : 'order-image-grid__item'}
                    draggable
                    onDragStart={(event) => dragOrderImage(event, active.folder.name, image)}
                    onClick={() => onSelectImage(active.folder.name, image.path)}
                    onContextMenu={(event) => onImageMenu(event, active.folder.name, image)}
                    title={image.name}
                  >
                    <img src={pathToFileUrl(image.path)} alt="" />
                    {showImageNames ? <span>{image.name}</span> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <ul className={`order-image-list order-image-list--${thumbSize}`}>
            {active.images.map((image) => {
              const selected = image.path === activeImagePath
              return (
                <li key={image.path}>
                  <button
                    type="button"
                    className={selected ? 'order-image-list__item order-image-list__item--selected' : 'order-image-list__item'}
                    draggable
                    onDragStart={(event) => dragOrderImage(event, active.folder.name, image)}
                    onClick={() => onSelectImage(active.folder.name, image.path)}
                    onContextMenu={(event) => onImageMenu(event, active.folder.name, image)}
                    title={image.name}
                  >
                    <img src={pathToFileUrl(image.path)} alt="" />
                    {showImageNames ? <span>{image.name}</span> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export function OrderKanbanBoard({
  folders,
  orderImagesPath,
  activeFolderName,
  activeImagePath,
  onSelectFolder,
  onSelectImage,
  onReorderFolders,
  view,
  thumbSize,
  showImageNames,
  onNewFolder,
  onImportImages
}: OrderKanbanBoardProps): ReactElement {
  const [folderData, setFolderData] = useState<FolderWithImages[]>([])
  const [loading, setLoading] = useState(true)
  const [imageReload, setImageReload] = useState(0)
  const [imageMenu, setImageMenu] = useState<{
    x: number
    y: number
    folder: string
    image: OrderFolderImage
  } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{
    folder: string
    image: OrderFolderImage
  } | null>(null)
  const [drag, setDrag] = useState<ColumnDragState | null>(null)
  const columnRefs = useRef(new Map<string, HTMLElement>())
  const hasFolderRows = useRef(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!hasFolderRows.current) setLoading(true)
      const rows: FolderWithImages[] = []
      for (const folder of folders) {
        const images = await window.orion.listOrderFolderImages(folder.name)
        rows.push({ folder, images })
      }
      if (!cancelled) {
        hasFolderRows.current = rows.length > 0
        setFolderData(rows)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [folders, imageReload])

  function openImageMenu(event: ReactMouseEvent, folder: string, image: OrderFolderImage): void {
    event.preventDefault()
    event.stopPropagation()
    setImageMenu({ x: event.clientX, y: event.clientY, folder, image })
  }

  function askDeleteImage(): void {
    if (!imageMenu) return
    setPendingDelete({ folder: imageMenu.folder, image: imageMenu.image })
    setImageMenu(null)
  }

  async function deleteMenuImage(): Promise<void> {
    if (!pendingDelete || typeof window.orion?.removeLibraryImage !== 'function') return
    const { folder, image } = pendingDelete
    setPendingDelete(null)
    const removed = await window.orion.removeLibraryImage(image.path)
    if (!removed) return
    if (activeImagePath === image.path) {
      const row = folderData.find((entry) => entry.folder.name === folder)
      const next = row?.images.find((item) => item.path !== image.path)
      if (next) onSelectImage(folder, next.path)
    }
    setImageReload((value) => value + 1)
  }

  const folderNames = folders.map((f) => f.name)
  const folderNamesKey = folderNames.join('\0')

  const getRect = (name: string): DOMRect | undefined =>
    columnRefs.current.get(name)?.getBoundingClientRect()

  const rowDragOwned = useRef(false)
  const ignoreFolderClick = useRef(false)

  useEffect(() => {
    if (!drag || rowDragOwned.current) return

    document.body.classList.add('orion-column-drag')
    const pointerId = drag.pointerId
    const fromName = drag.folderName

    const onPointerMove = (e: PointerEvent): void => {
      if (e.pointerId !== pointerId) return
      const dropTarget =
        view === 'columns'
          ? hitTestColumnDrop(e.clientX, folderNames, getRect)
          : hitTestListDrop(e.clientY, folderNames, getRect)
      setDrag((prev) =>
        prev && prev.pointerId === pointerId
          ? {
              ...prev,
              x: e.clientX - prev.offsetX,
              y: e.clientY - prev.offsetY,
              dropTarget
            }
          : null
      )
    }

    const onPointerUp = (e: PointerEvent): void => {
      if (e.pointerId !== pointerId) return
      const dropTarget =
        view === 'columns'
          ? hitTestColumnDrop(e.clientX, folderNames, getRect)
          : hitTestListDrop(e.clientY, folderNames, getRect)
      if (dropTarget) {
        onReorderFolders(fromName, dropTarget.targetName, dropTarget.position)
      }
      setDrag(null)
    }

    const onPointerCancel = (e: PointerEvent): void => {
      if (e.pointerId !== pointerId) return
      setDrag(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    return () => {
      document.body.classList.remove('orion-column-drag')
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [drag?.pointerId, folderNamesKey, onReorderFolders, view])

  function startColumnDrag(e: ReactPointerEvent<HTMLButtonElement>, name: string): void {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const col = columnRefs.current.get(name)
    if (!col) return
    const rect = col.getBoundingClientRect()
    setDrag({
      folderName: name,
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      x: rect.left,
      y: rect.top,
      dropTarget: null
    })
  }

  function startFolderRowDrag(e: ReactPointerEvent<HTMLButtonElement>, name: string): void {
    if (e.button !== 0) return
    const pointerId = e.pointerId
    const startX = e.clientX
    const startY = e.clientY
    const button = e.currentTarget
    button.setPointerCapture(pointerId)
    let started = false

    const onPointerMove = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) return
      if (!started) {
        if (Math.hypot(event.clientX - startX, event.clientY - startY) < 4) return
        const row = columnRefs.current.get(name)
        if (!row) return
        started = true
        rowDragOwned.current = true
        document.body.classList.add('orion-column-drag')
        const rect = row.getBoundingClientRect()
        setDrag({
          folderName: name,
          pointerId,
          offsetX: event.clientX - rect.left,
          offsetY: event.clientY - rect.top,
          width: rect.width,
          height: rect.height,
          x: rect.left,
          y: rect.top,
          dropTarget: null
        })
        return
      }
      const dropTarget = hitTestListDrop(event.clientY, folderNames, getRect)
      setDrag((prev) =>
        prev && prev.pointerId === pointerId
          ? {
              ...prev,
              x: event.clientX - prev.offsetX,
              y: event.clientY - prev.offsetY,
              dropTarget
            }
          : prev
      )
    }

    const finish = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) return
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      if (!started) return
      ignoreFolderClick.current = true
      window.setTimeout(() => {
        ignoreFolderClick.current = false
      }, 50)
      const dropTarget = hitTestListDrop(event.clientY, folderNames, getRect)
      if (dropTarget) onReorderFolders(name, dropTarget.targetName, dropTarget.position)
      rowDragOwned.current = false
      document.body.classList.remove('orion-column-drag')
      setDrag(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  const dragFolder = drag
    ? folderData.find(({ folder }) => folder.name === drag.folderName)
    : null
  const marker =
    drag?.dropTarget != null
      ? view === 'columns'
        ? dropMarkerRect(drag.dropTarget, getRect)
        : rowDropMarkerRect(drag.dropTarget, getRect)
      : null

  return (
    <div className={`order-workspace ${drag ? 'order-workspace--column-drag' : ''}`}>
      {view === 'columns' ? (
      <div className={`kanban-board kanban-board--${thumbSize}`}>
        {loading && folders.length > 0 ? (
          <p className="kanban-board__status adw-caption">Loading images…</p>
        ) : null}
        {!loading &&
          folderData.map(({ folder, images }) => {
            const columnActive = activeFolderName === folder.name
            const isSource = drag?.folderName === folder.name
            const columnClass = [
              'kanban-column',
              columnActive ? 'kanban-column--active' : '',
              isSource ? 'kanban-column--drag-source' : ''
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <section
                key={folder.name}
                ref={(el) => {
                  if (el) columnRefs.current.set(folder.name, el)
                  else columnRefs.current.delete(folder.name)
                }}
                className={columnClass}
              >
                <div className="kanban-column__header">
                  <button
                    type="button"
                    className="kanban-column__drag"
                    title="Drag to reorder column"
                    aria-label={`Reorder column ${folder.name}`}
                    onPointerDown={(e) => startColumnDrag(e, folder.name)}
                  >
                    <Icon icon={AppIcons.gripVertical} width={toolbarIconSize} height={toolbarIconSize} />
                  </button>
                  <button
                    type="button"
                    className="kanban-column__header-main"
                    onClick={() => onSelectFolder(folder.name)}
                  >
                    <AdwTooltip text={orderFolderPath(orderImagesPath, folder.name)} mono>
                      <span className="kanban-column__title">{folder.name}</span>
                    </AdwTooltip>
                    <span className="kanban-column__count adw-caption">{images.length}</span>
                  </button>
                </div>
                {images.length === 0 ? (
                  <div className="kanban-column__empty-state">
                    <Icon icon={AppIcons.images} width={24} height={24} />
                    <p className="adw-caption">No images in this folder</p>
                    <button
                      type="button"
                      className="adw-button adw-button--suggested adw-button--small"
                      onClick={() => void onImportImages(folder.name)}
                    >
                      Import images
                    </button>
                  </div>
                ) : (
                  <ul className={`kanban-column__grid kanban-column__grid--${thumbSize}`}>
                    {images.map((image) => {
                      const selected = activeImagePath === image.path
                      return (
                        <li key={image.path}>
                          <button
                            type="button"
                            className={
                              selected ? 'kanban-image kanban-image--selected' : 'kanban-image'
                            }
                            draggable
                            onDragStart={(event) => dragOrderImage(event, folder.name, image)}
                            onClick={() => onSelectImage(folder.name, image.path)}
                            onContextMenu={(event) => openImageMenu(event, folder.name, image)}
                            title={image.name}
                          >
                            <img
                              className="kanban-image__img"
                              src={pathToFileUrl(image.path)}
                              alt=""
                              loading="lazy"
                            />
                            {showImageNames ? (
                              <span className="kanban-image__label">{image.name}</span>
                            ) : null}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
        {folders.length === 0 ? (
          <div className="kanban-empty adw-card">
            <p className="adw-title-2">No folders</p>
            <p className="adw-caption">Create a folder, then add images to it.</p>
            <button type="button" className="adw-button adw-button--suggested" onClick={onNewFolder}>
              New folder
            </button>
          </div>
        ) : null}
      </div>
      ) : (
        <OrderBrowser
          view={view}
          loading={loading}
          folderData={folderData}
          activeFolderName={activeFolderName}
          activeImagePath={activeImagePath}
          onSelectFolder={onSelectFolder}
          onSelectImage={onSelectImage}
          thumbSize={thumbSize}
          showImageNames={showImageNames}
          onNewFolder={onNewFolder}
          onImportImages={onImportImages}
          folderRefs={columnRefs.current}
          onReorderPointerDown={startFolderRowDrag}
          shouldIgnoreFolderClick={() => {
            if (!ignoreFolderClick.current) return false
            ignoreFolderClick.current = false
            return true
          }}
          onImageMenu={openImageMenu}
        />
      )}

      {drag && dragFolder
        ? createPortal(
            <>
              {marker ? (
                <div
                  className={
                    'height' in marker
                      ? 'kanban-drop-marker'
                      : 'kanban-drop-marker kanban-drop-marker--row'
                  }
                  style={
                    'height' in marker
                      ? { left: marker.left, top: marker.top, height: marker.height }
                      : { left: marker.left, top: marker.top, width: marker.width }
                  }
                  aria-hidden
                />
              ) : null}
              <div
                className="kanban-column-ghost"
                style={{
                  width: drag.width,
                  height: drag.height,
                  left: drag.x,
                  top: drag.y
                }}
              >
                <div className="kanban-column-ghost__header">
                  <span className="kanban-column-ghost__title">{dragFolder.folder.name}</span>
                  <span className="kanban-column-ghost__count adw-caption">
                    {dragFolder.images.length}
                  </span>
                </div>
                <div className="kanban-column-ghost__grid">
                  {dragFolder.images.slice(0, 6).map((image) => (
                    <div key={image.path} className="kanban-column-ghost__thumb">
                      <img src={pathToFileUrl(image.path)} alt="" />
                    </div>
                  ))}
                </div>
              </div>
            </>,
            document.body
          )
        : null}
      {imageMenu ? (
        <AdwContextMenu x={imageMenu.x} y={imageMenu.y} onClose={() => setImageMenu(null)}>
          <AdwContextMenuItem label="Delete" destructive onSelect={askDeleteImage} />
        </AdwContextMenu>
      ) : null}
      <AdwAlertDialog
        open={pendingDelete != null}
        title="Delete image?"
        confirmLabel="Delete"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void deleteMenuImage()}
        body={
          <p>
            Delete “{pendingDelete?.image.name}” from {pendingDelete?.folder}. The file is removed
            from this computer.
          </p>
        }
      />
    </div>
  )
}
