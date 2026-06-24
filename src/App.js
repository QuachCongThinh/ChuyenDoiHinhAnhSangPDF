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
  ({ img, index, removeImage, resetToOriginal, handleAutoCrop, rotateImageReal }) => {
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

    const onCropComplete = (completedCrop) => {
      if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0 && imgRef.current) {
        handleAutoCrop(img.id, completedCrop, imgRef.current);
        setCrop(undefined);
      }
    };

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

          <div
            className="drag-handle-zone"
            title="Giữ và kéo để đổi thứ tự trang"
            {...attributes}
            {...listeners}
          ></div>

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
                style={{ transform: `rotate(${img.displayRotation || 0}deg)` }}
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
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

  const resetToOriginal = (id) => {
    setImages((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (item.url !== item.originalUrl) URL.revokeObjectURL(item.url);
          return { ...item, url: item.originalUrl, isCropped: false, rotation: 0 };
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

  // ==========================================
  // HÀM XUẤT PDF: TỰ ĐỘNG NHẬN DIỆN KHỔ GIẤY CHO TỪNG TRANG & FULL VIỀN
  // ==========================================
  const exportToPDF = async () => {
    if (images.length === 0) return;

    const pdf = new jsPDF({
      orientation: "p",
      unit: "mm",
      format: "a4",
    });

    for (let index = 0; index < images.length; index++) {
      const imgItem = images[index];

      const imgDataObj = await new Promise((resolve) => {
        const tempImg = new Image();
        tempImg.src = imgItem.url;
        tempImg.crossOrigin = "Anonymous";
        tempImg.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = tempImg.width;
          canvas.height = tempImg.height;
          ctx.drawImage(tempImg, 0, 0);
          resolve({
            dataUrl: canvas.toDataURL("image/jpeg", 0.95),
            w: tempImg.width,
            h: tempImg.height
          });
        };
      });

      const pageOrientation = imgDataObj.w > imgDataObj.h ? "l" : "p";

      if (index === 0) {
        if (pageOrientation === "l") {
          pdf.internal.pageSize.setHeight(210);
          pdf.internal.pageSize.setWidth(297);
        }
      } else {
        pdf.addPage("a4", pageOrientation);
      }

      const currentPdfWidth = pdf.internal.pageSize.getWidth();
      const currentPdfHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgDataObj.dataUrl, "JPEG", 0, 0, currentPdfWidth, currentPdfHeight);
    }

    pdf.save("[Converted Images].pdf");
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
                <h1>CHỈNH SỬA VÀ CHUYỂN ĐỔI ẢNH SANG PDF</h1>
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
                  ⚡ Xuất file PDF
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

        <h1 className="designer">--- Thiết kế: Quách Công Thịnh ---</h1>
      </div>
    </>
  );
}

export default App;

// import React, { useState, memo, useRef } from "react";
// import { jsPDF } from "jspdf";
// import Tesseract from 'tesseract.js';
// import {
//   DndContext,
//   rectIntersection,
//   KeyboardSensor,
//   PointerSensor,
//   useSensor,
//   useSensors,
// } from "@dnd-kit/core";
// import {
//   arrayMove,
//   SortableContext,
//   sortableKeyboardCoordinates,
//   rectSortingStrategy,
//   useSortable,
// } from "@dnd-kit/sortable";
// import { CSS } from "@dnd-kit/utilities";
// import ReactCrop from "react-image-crop";
// import "react-image-crop/dist/ReactCrop.css";
// import "./App.css";

// // ==========================================
// // COMPONENT CON: HIỂN THỊ VÀ XỬ LÝ TỪNG ẢNH
// // ==========================================
// const SortableImageItem = memo(
//   ({ img, index, removeImage, resetToOriginal, handleAutoCrop, rotateImageReal }) => {
//     const {
//       attributes,
//       listeners,
//       setNodeRef,
//       transform,
//       transition,
//       isDragging,
//     } = useSortable({ id: img.id });

//     const [crop, setCrop] = useState();
//     const imgRef = useRef(null);

//     const style = {
//       transform: CSS.Transform.toString(transform),
//       transition: isDragging
//         ? "none"
//         : transition || "transform 250ms cubic-bezier(0.2, 0, 0, 1)",
//       opacity: isDragging ? 0.3 : 1,
//       zIndex: isDragging ? 9999 : 1,
//     };

//     const onCropComplete = (completedCrop) => {
//       if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0 && imgRef.current) {
//         handleAutoCrop(img.id, completedCrop, imgRef.current);
//         setCrop(undefined);
//       }
//     };

//     const stopPropagationEvents = (e) => {
//       e.stopPropagation();
//     };

//     return (
//       <div
//         ref={setNodeRef}
//         style={style}
//         className={`image-item ${isDragging ? "is-dragging" : ""}`}
//       >
//         <div className="image-wrapper">
//           <span className="page-badge">Trang {index + 1}</span>

//           <div
//             className="drag-handle-zone"
//             title="Giữ và kéo để đổi thứ tự trang"
//             {...attributes}
//             {...listeners}
//           ></div>

//           <div
//             className="img-flat-container inline-crop-container"
//             onPointerDown={stopPropagationEvents}
//             onMouseDown={stopPropagationEvents}
//             onTouchStart={stopPropagationEvents}
//           >
//             <ReactCrop
//               crop={crop}
//               onChange={(c) => setCrop(c)}
//               onComplete={onCropComplete}
//             >
//               <img
//                 ref={imgRef}
//                 src={img.url}
//                 alt={img.name}
//                 draggable={false}
//               />
//             </ReactCrop>
//           </div>

//           <div className="image-overlay">
//             <button
//               className="icon-btn delete-btn"
//               onPointerDown={stopPropagationEvents}
//               onMouseDown={stopPropagationEvents}
//               onClick={(e) => {
//                 e.stopPropagation();
//                 removeImage(img.id);
//               }}
//               title="Xóa ảnh"
//             >
//               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
//                 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
//               </svg>
//             </button>
//           </div>

//           {img.isCropped && <span className="status-badge crop-badge">Đã cắt</span>}
//           {img.autoRotated && (
//             <span className="status-badge AI-badge" style={{ backgroundColor: "#10b981", left: "12px", right: "auto" }}>
//               ✨ AI Đã Chỉnh Thẳng ({img.rotation}°)
//             </span>
//           )}
//         </div>

//         <div className="item-meta">
//           <p className="file-name" title={img.name}>{img.name}</p>
//           <span className="file-size">
//             {img.size} {img.rotation > 0 ? `(Đã xoay xuôi ${img.rotation}°)` : ""}
//           </span>

//           <div className="item-actions-grid">
//             <button
//               className="btn-action-tile"
//               onClick={() => rotateImageReal(img.id, img.url, 90)}
//               title="Xoay thủ công thêm 90 độ"
//             >
//               🔄 Xoay 90°
//             </button>
//             <button
//               className="btn-action-tile btn-reset-tile"
//               onClick={() => resetToOriginal(img.id)}
//               title="Khôi phục ảnh gốc"
//             >
//               ↩️ Gốc
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   },
//   (prevProps, nextProps) => {
//     return (
//       prevProps.index === nextProps.index &&
//       prevProps.img.id === nextProps.img.id &&
//       prevProps.img.url === nextProps.img.url &&
//       prevProps.img.rotation === nextProps.img.rotation &&
//       prevProps.img.isCropped === nextProps.img.isCropped &&
//       prevProps.img.autoRotated === nextProps.img.autoRotated
//     );
//   }
// );

// // ==========================================
// // COMPONENT CHÍNH: APP
// // ==========================================
// function App() {
//   const [images, setImages] = useState([]);
//   const [isDragging, setIsDragging] = useState(false);
//   const [showConfirmModal, setShowConfirmModal] = useState(false);
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [processingMessage, setProcessingMessage] = useState("Đang xử lý ảnh...");

//   const sensors = useSensors(
//     useSensor(PointerSensor, {
//       activationConstraint: {
//         distance: 4,
//       },
//     }),
//     useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
//   );

//   // HÀM AI XỬ LÝ CHUẨN XÁC CHO CẢ MẶT TRƯỚC VÀ MẶT SAU CCCD TỰ ĐỘNG
//   const detectAndRotateCore = async (blobUrl) => {
//     const testAngles = [0, 90, 180, 270];

//     // Từ khóa mặt trước (Tiêu đề)
//     const frontKeywords = [
//       "CONG HOA", "CỘNG HÒA", "XA HOI", "XÃ HỘI",
//       "CAN CUOC", "CĂN CƯỚC", "GIAY CHUNG NHAN", "GIẤY CHỨNG NHẬN"
//     ];

//     // Từ khóa mặt sau (Đầu dòng mã vạch quốc tế MRZ đặc trưng của CCCD Việt Nam)
//     const backKeywords = [
//       "IDVNM", "15VN", "NGUYEN"
//     ];

//     // Hàm kiểm tra xem văn bản đọc được có chứa từ khóa hợp lệ hay không
//     const checkValidText = (text) => {
//       if (!text) return false;
//       const upperText = text.toUpperCase().replace(/\s+/g, ''); // Xóa khoảng trắng để tránh AI đọc lệch

//       // Kiểm tra mặt trước
//       const hasFront = frontKeywords.some(kw => upperText.includes(kw.toUpperCase().replace(/\s+/g, '')));
//       // Kiểm tra mặt sau (Mã MRZ)
//       const hasBack = backKeywords.some(kw => upperText.includes(kw));

//       return hasFront || hasBack;
//     };

//     // Hàm vẽ xoay tạm thời trên Canvas để đưa dữ liệu ảnh cho AI đọc thử
//     const rotateCanvasToAngle = (imgElement, angle) => {
//       const canvas = document.createElement("canvas");
//       const ctx = canvas.getContext("2d");

//       if (angle === 90 || angle === 270) {
//         canvas.width = imgElement.naturalHeight;
//         canvas.height = imgElement.naturalWidth;
//       } else {
//         canvas.width = imgElement.naturalWidth;
//         canvas.height = imgElement.naturalHeight;
//       }

//       ctx.translate(canvas.width / 2, canvas.height / 2);
//       ctx.rotate((angle * Math.PI) / 180);
//       ctx.drawImage(imgElement, -imgElement.naturalWidth / 2, -imgElement.naturalHeight / 2);
//       return canvas.toDataURL("image/jpeg", 0.85);
//     };

//     try {
//       const img = await new Promise((resolve, reject) => {
//         const image = new Image();
//         image.src = blobUrl;
//         image.onload = () => resolve(image);
//         image.onerror = (err) => reject(err);
//       });

//       let finalDegreeNeeded = 0;
//       let foundCorrectDirection = false;

//       // THỬ NGHIỆM LẦN LƯỢT 4 GÓC ĐỂ TÌM HƯỚNG ĐỌC XUÔI CHỮ ĐÚNG NGHĨA
//       for (const angle of testAngles) {
//         const testImageDataUrl = rotateCanvasToAngle(img, angle);

//         // Gọi AI bóc tách văn bản thô
//         const { data: { text } } = await Tesseract.recognize(testImageDataUrl, 'vie', {
//           options: {
//             langPath: 'https://tessdata.projectnaptha.com/4.0.0'
//           }
//         });

//         console.log(`Góc thử nghiệm ${angle}° - Chữ quét được:`, text);

//         if (checkValidText(text)) {
//           finalDegreeNeeded = angle;
//           foundCorrectDirection = true;
//           console.log(`=> Đã xác định được hướng thuận chuẩn của giấy tờ tại góc: ${angle}°`);
//           break; // Dừng ngay vòng lặp khi đã tìm được góc đọc xuôi từ trái sang phải
//         }
//       }

//       // Nếu là ảnh mặt sau nhưng quá mờ không nhận diện được chữ, áp dụng Fallback lật theo tỷ lệ khung hình
//       if (!foundCorrectDirection) {
//         console.warn("AI không đọc được từ khóa, áp dụng bộ lọc đo kích thước khung hình vật lý.");
//         // Nếu ảnh đang bị đứng (Cao > Rộng) thì tự động lật ngang 90 độ để bè ngang ra giống mặt trước
//         if (img.naturalHeight > img.naturalWidth) {
//           finalDegreeNeeded = 90;
//         } else {
//           return { finalUrl: blobUrl, finalRotation: 0, autoRotated: false };
//         }
//       }

//       if (finalDegreeNeeded === 0) {
//         return { finalUrl: blobUrl, finalRotation: 0, autoRotated: false };
//       }

//       // XUẤT ĐỒNG BỘ ẢNH ĐẦU RA SAU KHI ĐÃ ĐƯỢC XOAY CHUẨN XUÔI CHIỀU CHỮ
//       return new Promise((resolve) => {
//         const canvas = document.createElement("canvas");
//         const ctx = canvas.getContext("2d");

//         if (finalDegreeNeeded === 90 || finalDegreeNeeded === 270) {
//           canvas.width = img.naturalHeight;
//           canvas.height = img.naturalWidth;
//         } else {
//           canvas.width = img.naturalWidth;
//           canvas.height = img.naturalHeight;
//         }

//         ctx.translate(canvas.width / 2, canvas.height / 2);
//         ctx.rotate((finalDegreeNeeded * Math.PI) / 180);
//         ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

//         canvas.toBlob((blob) => {
//           if (!blob) {
//             resolve({ finalUrl: blobUrl, finalRotation: 0, autoRotated: false });
//             return;
//           }
//           const rotatedBlobUrl = URL.createObjectURL(blob);
//           resolve({ finalUrl: rotatedBlobUrl, finalRotation: finalDegreeNeeded, autoRotated: true });
//         }, "image/jpeg", 0.95);
//       });

//     } catch (err) {
//       console.error("Lỗi xử lý logic xoay ảnh:", err);
//       return { finalUrl: blobUrl, finalRotation: 0, autoRotated: false };
//     }
//   };

//   const processFiles = async (files) => {
//     setIsProcessing(true);
//     setProcessingMessage("AI đang nhận diện hướng chữ và tự động đưa giấy tờ về chiều thuận đọc...");

//     const loadedImages = [];
//     for (let i = 0; i < files.length; i++) {
//       const file = files[i];
//       const originUrl = URL.createObjectURL(file);

//       const { finalUrl, finalRotation, autoRotated } = await detectAndRotateCore(originUrl);

//       loadedImages.push({
//         id: `img-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
//         url: finalUrl,
//         originalUrl: originUrl,
//         name: file.name,
//         size: (file.size / 1024).toFixed(1) + " KB",
//         isCropped: false,
//         rotation: finalRotation,
//         autoRotated: autoRotated,
//       });
//     }

//     setImages((prev) => [...prev, ...loadedImages]);
//     setIsProcessing(false);
//   };

//   const handleImageChange = (e) => {
//     if (e.target.files) processFiles(Array.from(e.target.files));
//   };

//   const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
//   const handleDragLeave = () => { setIsDragging(false); };
//   const handleDrop = (e) => {
//     e.preventDefault();
//     setIsDragging(false);
//     const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
//     processFiles(files);
//   };

//   const handleDragEnd = (event) => {
//     const { active, over } = event;
//     if (active && over && active.id !== over.id) {
//       setImages((items) => {
//         const oldIndex = items.findIndex((item) => item.id === active.id);
//         const newIndex = items.findIndex((item) => item.id === over.id);
//         return arrayMove(items, oldIndex, newIndex);
//       });
//     }
//   };

//   const rotateImageReal = (id, currentUrl, angle = 90) => {
//     setIsProcessing(true);
//     setProcessingMessage("Đang xoay ảnh thủ công...");
//     const img = new Image();
//     img.src = currentUrl;
//     img.onload = () => {
//       const canvas = document.createElement("canvas");
//       const ctx = canvas.getContext("2d");

//       canvas.width = img.height;
//       canvas.height = img.width;

//       ctx.translate(canvas.width / 2, canvas.height / 2);
//       ctx.rotate((angle * Math.PI) / 180);
//       ctx.drawImage(img, -img.width / 2, -img.height / 2);

//       canvas.toBlob(
//         (blob) => {
//           if (!blob) {
//             setIsProcessing(false);
//             return;
//           }
//           const target = images.find(item => item.id === id);
//           if (target && target.url !== target.originalUrl) {
//             URL.revokeObjectURL(target.url);
//           }

//           const rotatedUrl = URL.createObjectURL(blob);
//           setImages((prev) =>
//             prev.map((item) =>
//               item.id === id ? { ...item, url: rotatedUrl, rotation: ((item.rotation || 0) + angle) % 360 } : item
//             )
//           );
//           setIsProcessing(false);
//         },
//         "image/jpeg",
//         0.95
//       );
//     };
//   };

//   const handleAutoCrop = (id, completedCrop, imageElement) => {
//     if (!completedCrop || !imageElement) return;

//     setIsProcessing(true);
//     setProcessingMessage("Đang thực hiện cắt ảnh...");
//     const canvas = document.createElement("canvas");
//     const ctx = canvas.getContext("2d");

//     const scaleX = imageElement.naturalWidth / imageElement.width;
//     const scaleY = imageElement.naturalHeight / imageElement.height;

//     canvas.width = completedCrop.width * scaleX;
//     canvas.height = completedCrop.height * scaleY;

//     ctx.imageSmoothingEnabled = true;
//     ctx.imageSmoothingQuality = "high";

//     ctx.drawImage(
//       imageElement,
//       completedCrop.x * scaleX,
//       completedCrop.y * scaleY,
//       completedCrop.width * scaleX,
//       completedCrop.height * scaleY,
//       0,
//       0,
//       canvas.width,
//       canvas.height
//     );

//     canvas.toBlob(
//       (blob) => {
//         if (!blob) {
//           setIsProcessing(false);
//           return;
//         }
//         const target = images.find(item => item.id === id);
//         if (target && target.url !== target.originalUrl) {
//           URL.revokeObjectURL(target.url);
//         }

//         const croppedUrl = URL.createObjectURL(blob);
//         setImages((prev) =>
//           prev.map((item) =>
//             item.id === id ? { ...item, url: croppedUrl, isCropped: true } : item
//           )
//         );
//         setIsProcessing(false);
//       },
//       "image/jpeg",
//       0.95
//     );
//   };

//   const resetToOriginal = (id) => {
//     setImages((prev) =>
//       prev.map((item) => {
//         if (item.id === id) {
//           if (item.url !== item.originalUrl) URL.revokeObjectURL(item.url);
//           return { ...item, url: item.originalUrl, isCropped: false, rotation: 0, autoRotated: false };
//         }
//         return item;
//       })
//     );
//   };

//   const removeImage = (id) => {
//     setImages((prevImages) => {
//       const target = prevImages.find((img) => img.id === id);
//       if (target) {
//         if (target.url) URL.revokeObjectURL(target.url);
//         if (target.originalUrl && target.originalUrl !== target.url) URL.revokeObjectURL(target.originalUrl);
//       }
//       return prevImages.filter((img) => img.id !== id);
//     });
//   };

//   const confirmClearAll = () => {
//     images.forEach((img) => {
//       if (img.url) URL.revokeObjectURL(img.url);
//       if (img.originalUrl && img.originalUrl !== img.url) URL.revokeObjectURL(img.originalUrl);
//     });
//     setImages([]);
//     setShowConfirmModal(false);
//   };

//   const exportToPDF = async () => {
//     if (images.length === 0) return;

//     const pdf = new jsPDF({
//       orientation: "p",
//       unit: "mm",
//       format: "a4",
//     });

//     for (let index = 0; index < images.length; index++) {
//       const imgItem = images[index];

//       const imgDataObj = await new Promise((resolve) => {
//         const tempImg = new Image();
//         tempImg.src = imgItem.url;
//         tempImg.crossOrigin = "Anonymous";
//         tempImg.onload = () => {
//           const canvas = document.createElement("canvas");
//           const ctx = canvas.getContext("2d");
//           canvas.width = tempImg.width;
//           canvas.height = tempImg.height;
//           ctx.drawImage(tempImg, 0, 0);
//           resolve({
//             dataUrl: canvas.toDataURL("image/jpeg", 0.95),
//             w: tempImg.width,
//             h: tempImg.height
//           });
//         };
//       });

//       const pageOrientation = imgDataObj.w > imgDataObj.h ? "l" : "p";

//       if (index === 0) {
//         if (pageOrientation === "l") {
//           pdf.internal.pageSize.setHeight(210);
//           pdf.internal.pageSize.setWidth(297);
//         }
//       } else {
//         pdf.addPage("a4", pageOrientation);
//       }

//       const currentPdfWidth = pdf.internal.pageSize.getWidth();
//       const currentPdfHeight = pdf.internal.pageSize.getHeight();

//       pdf.addImage(imgDataObj.dataUrl, "JPEG", 0, 0, currentPdfWidth, currentPdfHeight);
//     }

//     pdf.save("[Converted Images].pdf");
//   };

//   return (
//     <>
//       {isProcessing && (
//         <div className="loading-overlay">
//           <div className="spinner"></div>
//           <p>{processingMessage}</p>
//         </div>
//       )}
//       <div className="app-layout">
//         <div className="container">
//           <header className="app-header">
//             <div className="logo-zone">
//               <span className="logo-icon">⚡</span>
//               <div>
//                 <h1>CHỈNH SỬA VÀ CHUYỂN ĐỔI ẢNH SANG PDF</h1>
//                 <p>Hệ thống tự động xoay chuẩn hướng đọc tài liệu AI • Kéo thả chuột trên mặt ảnh để cắt nhanh</p>
//               </div>
//             </div>
//           </header>

//           <div
//             className={`upload-section ${isDragging ? "drag-over" : ""}`}
//             onDragOver={handleDragOver}
//             onDragLeave={handleDragLeave}
//             onDrop={handleDrop}
//           >
//             <label htmlFor="file-upload" className="custom-file-upload">
//               <div className="upload-icon">
//                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
//                   <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
//                 </svg>
//               </div>
//               <div className="upload-text">
//                 <span className="highlight">Nhấp để chọn ảnh</span> <span className="desktop-only">hoặc kéo thả vào đây</span>
//               </div>
//             </label>
//             <input id="file-upload" type="file" multiple accept="image/*" onChange={handleImageChange} />
//           </div>

//           {images.length > 0 && (
//             <div className="preview-section">
//               <div className="section-header">
//                 <h3>
//                   Tệp đã tải ({images.length}){" "}
//                   <span className="sort-tip desktop-only">
//                     (Ảnh đã được AI quét tự động đưa về đúng chiều đọc thuận của giấy tờ)
//                   </span>
//                 </h3>
//                 <button className="clear-all-btn" onClick={() => setShowConfirmModal(true)}>
//                   Xóa tất cả
//                 </button>
//               </div>

//               <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragEnd={handleDragEnd}>
//                 <SortableContext items={images.map((img) => img.id)} strategy={rectSortingStrategy}>
//                   <div className="image-grid">
//                     {images.map((img, index) => (
//                       <SortableImageItem
//                         key={img.id}
//                         img={img}
//                         index={index}
//                         removeImage={removeImage}
//                         resetToOriginal={resetToOriginal}
//                         handleAutoCrop={handleAutoCrop}
//                         rotateImageReal={rotateImageReal}
//                       />
//                     ))}
//                   </div>
//                 </SortableContext>
//               </DndContext>

//               <div className="export-container">
//                 <button className="export-btn" onClick={exportToPDF}>
//                   ⚡ Xuất file PDF
//                 </button>
//               </div>
//             </div>
//           )}
//         </div>

//         {showConfirmModal && (
//           <div className="modal-backdrop" onClick={() => setShowConfirmModal(false)}>
//             <div className="modal-box" onClick={(e) => e.stopPropagation()}>
//               <h2>Xác nhận xóa sạch?</h2>
//               <p>Hành động này sẽ xóa toàn bộ hình ảnh hiện tại khỏi danh sách.</p>
//               <div className="modal-actions">
//                 <button className="modal-btn-cancel" onClick={() => setShowConfirmModal(false)}>Hủy bỏ</button>
//                 <button className="modal-btn-confirm" onClick={confirmClearAll}>Đồng ý xóa</button>
//               </div>
//             </div>
//           </div>
//         )}

//         <h1 className="designer">--- Thiết kế: Quách Công Thịnh ---</h1>
//       </div>
//     </>
//   );
// }

// export default App;