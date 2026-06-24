import React, { useState, memo, useRef } from "react";
import { jsPDF } from "jspdf";
import {
  DndContext,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import "./App.css";

// ==========================================
// COMPONENT CON: HIỂN THỊ VÀ XỬ LÝ TỪNG ẢNH
// ==========================================
const SortableImageItem = memo(
  ({ img, index, removeImage, sharpenImage, resetToOriginal, handleAutoCrop, rotateImageReal }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: img.id });

    const [crop, setCrop] = useState();
    const imgRef = useRef(null);

    const style = {
      transform: CSS.Transform.toString(transform),
      transition: isDragging
        ? "none"
        : transition || "transform 250ms cubic-bezier(0.2, 0, 0, 1)",
      opacity: isDragging ? 0.3 : 1,
      zIndex: isDragging ? 9999 : 1,
    };

    // Tự động cắt ngay khi nhả chuột
    const onCropComplete = (completedCrop) => {
      if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0 && imgRef.current) {
        handleAutoCrop(img.id, completedCrop, imgRef.current);
        setCrop(undefined);
      }
    };

    // Hàm chặn triệt để sự kiện kéo thả lan truyền vào khu vực ảnh
    const stopPropagationEvents = (e) => {
      e.stopPropagation();
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`image-item ${isDragging ? "is-dragging" : ""}`}
      >
        <div className="image-wrapper">
          <span className="page-badge">Trang {index + 1}</span>

          {/* VÙNG NẮM KÉO THẢ: Chỉ bấm vào thanh xám này mới đổi được thứ tự trang */}
          <div
            className="drag-handle-zone"
            title="Giữ và kéo để đổi thứ tự trang"
            {...attributes}
            {...listeners}
          ></div>

          {/* VÙNG ẢNH: Chặn tất cả các sự kiện nhấn để nhường toàn quyền cho ReactCrop vẽ khung và resize */}
          <div
            className="img-flat-container inline-crop-container"
            onPointerDown={stopPropagationEvents}
            onMouseDown={stopPropagationEvents}
            onTouchStart={stopPropagationEvents}
          >
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={onCropComplete}
            >
              <img
                ref={imgRef}
                src={img.url}
                alt={img.name}
                draggable={false}
              />
            </ReactCrop>
          </div>

          <div className="image-overlay">
            <button
              className="icon-btn delete-btn"
              onPointerDown={stopPropagationEvents}
              onMouseDown={stopPropagationEvents}
              onClick={(e) => {
                e.stopPropagation();
                removeImage(img.id);
              }}
              title="Xóa ảnh"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {img.isSharpened && <span className="status-badge">Đã nét</span>}
          {img.isCropped && <span className="status-badge crop-badge">Đã cắt</span>}
        </div>

        <div className="item-meta">
          <p className="file-name" title={img.name}>{img.name}</p>
          <span className="file-size">
            {img.size} {img.rotation > 0 ? `(Đã xoay ${img.rotation}°)` : ""}
          </span>

          <div className="item-actions-grid">
            <button
              className="btn-action-tile"
              onClick={() => rotateImageReal(img.id, img.url)}
              title="Xoay thực tế ảnh 90 độ"
            >
              🔄 Xoay 90°
            </button>
            <button
              className="btn-action-tile"
              onClick={() => sharpenImage(img.id, img.url)}
              disabled={img.isSharpened}
            >
              ✨ {img.isSharpened ? "Đã nét" : "Làm nét"}
            </button>
            <button
              className="btn-action-tile btn-reset-tile"
              onClick={() => resetToOriginal(img.id)}
              title="Khôi phục ảnh gốc"
            >
              ↩️ Gốc
            </button>
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.index === nextProps.index &&
      prevProps.img.id === nextProps.img.id &&
      prevProps.img.url === nextProps.img.url &&
      prevProps.img.rotation === nextProps.img.rotation &&
      prevProps.img.isSharpened === nextProps.img.isSharpened &&
      prevProps.img.isCropped === nextProps.img.isCropped
    );
  }
);

// ==========================================
// COMPONENT CHÍNH: APP
// ==========================================
function App() {
  const [images, setImages] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Đưa cấu hình Sensor về dạng chuẩn, mượt mà và không xung đột
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4, // Ngăn việc click nhẹ bị nhận nhầm thành di chuyển
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const processFiles = (files) => {
    const newImages = files.map((file, index) => {
      const blobUrl = URL.createObjectURL(file);
      return {
        id: `img-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
        url: blobUrl,
        originalUrl: blobUrl,
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
        isSharpened: false,
        isCropped: false,
        rotation: 0,
      };
    });
    setImages((prev) => [...prev, ...newImages]);
  };

  const handleImageChange = (e) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => { setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
    processFiles(files);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Xoay thực tế bằng canvas
  const rotateImageReal = (id, currentUrl) => {
    setIsProcessing(true);

    const img = new Image();
    img.src = currentUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.height;
      canvas.height = img.width;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setIsProcessing(false);
            return;
          }
          const target = images.find(item => item.id === id);
          if (target && target.url !== target.originalUrl) {
            URL.revokeObjectURL(target.url);
          }

          const rotatedUrl = URL.createObjectURL(blob);
          setImages((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, url: rotatedUrl, rotation: ((item.rotation || 0) + 90) % 360 } : item
            )
          );
          setIsProcessing(false);
        },
        "image/jpeg",
        0.95
      );
    };
  };

  // Tự động cắt ảnh khi nhả chuột
  const handleAutoCrop = (id, completedCrop, imageElement) => {
    if (!completedCrop || !imageElement) return;

    setIsProcessing(true);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const scaleX = imageElement.naturalWidth / imageElement.width;
    const scaleY = imageElement.naturalHeight / imageElement.height;

    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
      imageElement,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setIsProcessing(false);
          return;
        }
        const target = images.find(item => item.id === id);
        if (target && target.url !== target.originalUrl) {
          URL.revokeObjectURL(target.url);
        }

        const croppedUrl = URL.createObjectURL(blob);
        setImages((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, url: croppedUrl, isCropped: true } : item
          )
        );
        setIsProcessing(false);
      },
      "image/jpeg",
      0.95
    );
  };

  // Bộ lọc làm nét tài liệu
  const sharpenImage = (id, currentUrl) => {
    setIsProcessing(true);
    setTimeout(() => {
      const img = new Image();
      img.src = currentUrl;
      img.onload = () => {
        const MAX_WIDTH = 1500;
        let w = img.width;
        let h = img.height;
        if (w > MAX_WIDTH) {
          h = (MAX_WIDTH * h) / w;
          w = MAX_WIDTH;
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const output = ctx.createImageData(w, h);
        const outputData = output.data;
        const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];

        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            for (let c = 0; c < 3; c++) {
              let i = (y * w + x) * 4 + c;
              let val = 0;
              for (let cy = 0; cy < 3; cy++) {
                for (let cx = 0; cx < 3; cx++) {
                  let pIdx = ((y + cy - 1) * w + (x + cx - 1)) * 4 + c;
                  val += data[pIdx] * k[cy * 3 + cx];
                }
              }
              outputData[i] = Math.min(255, Math.max(0, val));
            }
            outputData[(y * w + x) * 4 + 3] = data[(y * w + x) * 4 + 3];
          }
        }
        ctx.putImageData(output, 0, 0);

        canvas.toBlob(
          (blob) => {
            const target = images.find(item => item.id === id);
            if (target && target.url !== target.originalUrl) {
              URL.revokeObjectURL(target.url);
            }
            const sharpenedUrl = URL.createObjectURL(blob);
            setImages((prev) =>
              prev.map((item) =>
                item.id === id ? { ...item, url: sharpenedUrl, isSharpened: true } : item
              )
            );
            setIsProcessing(false);
          },
          "image/jpeg",
          0.95
        );
      };
    }, 100);
  };

  const resetToOriginal = (id) => {
    setImages((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (item.url !== item.originalUrl) URL.revokeObjectURL(item.url);
          return { ...item, url: item.originalUrl, isSharpened: false, isCropped: false, rotation: 0 };
        }
        return item;
      })
    );
  };

  const removeImage = (id) => {
    setImages((prevImages) => {
      const target = prevImages.find((img) => img.id === id);
      if (target) {
        if (target.url) URL.revokeObjectURL(target.url);
        if (target.originalUrl && target.originalUrl !== target.url) URL.revokeObjectURL(target.originalUrl);
      }
      return prevImages.filter((img) => img.id !== id);
    });
  };

  const confirmClearAll = () => {
    images.forEach((img) => {
      if (img.url) URL.revokeObjectURL(img.url);
      if (img.originalUrl && img.originalUrl !== img.url) URL.revokeObjectURL(img.originalUrl);
    });
    setImages([]);
    setShowConfirmModal(false);
  };

  const exportToPDF = async () => {
    if (images.length === 0) return;

    const pdf = new jsPDF({
      orientation: "p",
      unit: "mm",
      format: "a4",
    });

    for (let index = 0; index < images.length; index++) {
      const imgItem = images[index];

      const dataUrl = await new Promise((resolve) => {
        const tempImg = new Image();
        tempImg.src = imgItem.url;
        tempImg.crossOrigin = "Anonymous";
        tempImg.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = tempImg.width;
          canvas.height = tempImg.height;
          ctx.drawImage(tempImg, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.95));
        };
      });

      if (index !== 0) pdf.addPage();

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const margin = 10;

      pdf.addImage(dataUrl, "JPEG", margin, margin, pdfWidth - 20, (pdfWidth - 20) * 1.4);
    }

    pdf.save("converted.pdf");
  };

  return (
    <>
      {isProcessing && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Đang xử lý ảnh...</p>
        </div>
      )}
      <div className="app-layout">
        <div className="container">
          <header className="app-header">
            <div className="logo-zone">
              <span className="logo-icon">⚡</span>
              <div>
                <h1>CHUYỂN ĐỔI ẢNH SANG PDF</h1>
                <p>Kéo thanh xám để xếp thứ tự trang • Click kéo chuột trên mặt ảnh để chọn cắt tự do</p>
              </div>
            </div>
          </header>

          <div
            className={`upload-section ${isDragging ? "drag-over" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <label htmlFor="file-upload" className="custom-file-upload">
              <div className="upload-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
              </div>
              <div className="upload-text">
                <span className="highlight">Nhấp để chọn ảnh</span> <span className="desktop-only">hoặc kéo thả vào đây</span>
              </div>
            </label>
            <input id="file-upload" type="file" multiple accept="image/*" onChange={handleImageChange} />
          </div>

          {images.length > 0 && (
            <div className="preview-section">
              <div className="section-header">
                <h3>
                  Tệp đã tải ({images.length}){" "}
                  <span className="sort-tip desktop-only">
                    (Kéo thanh xám ở đầu để xếp trang • Kéo thả chuột trên mặt ảnh để CẮT)
                  </span>
                </h3>
                <button className="clear-all-btn" onClick={() => setShowConfirmModal(true)}>
                  Xóa tất cả
                </button>
              </div>

              <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragEnd={handleDragEnd}>
                <SortableContext items={images.map((img) => img.id)} strategy={rectSortingStrategy}>
                  <div className="image-grid">
                    {images.map((img, index) => (
                      <SortableImageItem
                        key={img.id}
                        img={img}
                        index={index}
                        removeImage={removeImage}
                        sharpenImage={sharpenImage}
                        resetToOriginal={resetToOriginal}
                        handleAutoCrop={handleAutoCrop}
                        rotateImageReal={rotateImageReal}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <div className="export-container">
                <button className="export-btn" onClick={exportToPDF}>
                  ⚡ Xuất file PDF chất lượng cao
                </button>
              </div>
            </div>
          )}
        </div>

        {showConfirmModal && (
          <div className="modal-backdrop" onClick={() => setShowConfirmModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <h2>Xác nhận xóa sạch?</h2>
              <p>Hành động này sẽ xóa toàn bộ hình ảnh hiện tại khỏi danh sách.</p>
              <div className="modal-actions">
                <button className="modal-btn-cancel" onClick={() => setShowConfirmModal(false)}>Hủy bỏ</button>
                <button className="modal-btn-confirm" onClick={confirmClearAll}>Đồng ý xóa</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
export default App;