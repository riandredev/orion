import { Icon } from '@iconify/react'
import { useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import type { OrderFolderImage, OrderFolderInfo } from '../env'
import { dropMarkerRect, hitTestColumnDrop, type ColumnDropTarget } from '../lib/column-drag'
import { writeSequenceDrag } from '../lib/sequence-drag'
import type { OrderLibraryView, OrderThumbSize } from './OrderBlockRibbon'
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
  onNewFolder: () => void
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
  onNewFolder
}: {
  view: OrderLibraryView
  loading: boolean
  folderData: FolderWithImages[]
  activeFolderName: string | null
  activeImagePath: string | null
  onSelectFolder: (name: string) => void
  onSelectImage: (folderName: string, path: string) => void
  thumbSize: OrderThumbSize
  onNewFolder: () => void
}): ReactElement {
  const active = folderData.find(({ folder }) => folder.name === activeFolderName) ?? null

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
                <li key={folder.name}>
                  <button
                    type="button"
                    className={selected ? 'order-folder-list__item order-folder-list__item--selected' : 'order-folder-list__item'}
                    onClick={() => onSelectFolder(folder.name)}
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
          <p className="adw-caption order-browser__status">No images in this folder</p>
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
                  >
                    <img src={pathToFileUrl(image.path)} alt="" />
                    <span>{image.name}</span>
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
                  >
                    <img src={pathToFileUrl(image.path)} alt="" />
                    <span>{image.name}</span>
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
  onNewFolder
}: OrderKanbanBoardProps): ReactElement {
  const [folderData, setFolderData] = useState<FolderWithImages[]>([])
  const [loading, setLoading] = useState(true)
  const [drag, setDrag] = useState<ColumnDragState | null>(null)
  const columnRefs = useRef(new Map<string, HTMLElement>())

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const rows: FolderWithImages[] = []
      for (const folder of folders) {
        const images = await window.orion.listOrderFolderImages(folder.name)
        rows.push({ folder, images })
      }
      if (!cancelled) {
        setFolderData(rows)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [folders])

  const folderNames = folders.map((f) => f.name)
  const folderNamesKey = folderNames.join('\0')

  const getRect = (name: string): DOMRect | undefined =>
    columnRefs.current.get(name)?.getBoundingClientRect()

  useEffect(() => {
    if (!drag) return

    document.body.classList.add('orion-column-drag')
    const pointerId = drag.pointerId
    const fromName = drag.folderName

    const onPointerMove = (e: PointerEvent): void => {
      if (e.pointerId !== pointerId) return
      const dropTarget = hitTestColumnDrop(e.clientX, folderNames, getRect)
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
      const dropTarget = hitTestColumnDrop(e.clientX, folderNames, getRect)
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
  }, [drag?.pointerId, folderNamesKey, onReorderFolders])

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

  const dragFolder = drag
    ? folderData.find(({ folder }) => folder.name === drag.folderName)
    : null
  const marker =
    drag?.dropTarget != null ? dropMarkerRect(drag.dropTarget, getRect) : null

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
                  <p className="kanban-column__empty adw-caption">No images in this folder</p>
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
                            title={image.name}
                          >
                            <img
                              className="kanban-image__img"
                              src={pathToFileUrl(image.path)}
                              alt=""
                              loading="lazy"
                            />
                            <span className="kanban-image__label">{image.name}</span>
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
          onNewFolder={onNewFolder}
        />
      )}

      {drag && dragFolder
        ? createPortal(
            <>
              {marker ? (
                <div
                  className="kanban-drop-marker"
                  style={{
                    left: marker.left,
                    top: marker.top,
                    height: marker.height
                  }}
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
    </div>
  )
}
