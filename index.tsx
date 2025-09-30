/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from '@google/genai';

const App = () => {
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState('45 phút');
  const [files, setFiles] = useState<File[]>([]);
  const [lessonPlan, setLessonPlan] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Helper function to convert file to a base64 string and format for the API
  const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
    const data = await base64EncodedDataPromise;
    return {
      inlineData: {
        data,
        mimeType: file.type,
      },
    };
  };

  const handleGenerate = async () => {
    if (!topic || files.length === 0) {
      setError('Vui lòng nhập chủ đề và chọn ít nhất một tệp tài liệu.');
      return;
    }

    setIsLoading(true);
    setError('');
    setLessonPlan('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      const fileParts = await Promise.all(
        files.map(fileToGenerativePart)
      );

      const prompt = `Dựa vào các tài liệu được cung cấp và chủ đề "${topic}", hãy thiết kế một kế hoạch bài giảng chi tiết trong ${duration}. Kế hoạch cần bao gồm các hoạt động vui nhộn, sáng tạo và hấp dẫn, phù hợp với mọi đối tượng học sinh. Vui lòng cấu trúc bài giảng rõ ràng theo từng phần (ví dụ: Khởi động, Hình thành kiến thức mới, Luyện tập, Vận dụng), ước tính thời gian cho mỗi hoạt động. Sau mỗi hoạt động, hãy bổ sung thêm mục "Sản phẩm đầu ra" hoặc "Đáp án" của bài tập. Trình bày kế hoạch dưới dạng văn bản liền mạch, không chia cột. Sử dụng markdown để định dạng, ví dụ: **để in đậm** và *để in nghiêng*.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          parts: [{ text: prompt }, ...fileParts],
        }],
      });

      setLessonPlan(response.text);
    } catch (err) {
      console.error(err);
      setError('Đã xảy ra lỗi khi tạo kế hoạch. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const parseMarkdown = (text: string): string => {
    if (!text) return "";
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>')   // Italic
      .replace(/\n/g, '<br />');              // Newlines
  };

  const handleDownload = () => {
    if (!lessonPlan || !topic) return;

    // Sanitize the topic for a valid filename
    const fileName = `ke-hoach-bai-giang-${topic.replace(/\s+/g, '-').toLowerCase()}.docx`;
    
    // Create HTML content for the docx file, parsing markdown
    const preHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Kế hoạch bài giảng</title></head><body>";
    const postHtml = "</body></html>";
    const content = parseMarkdown(lessonPlan);
    const html = preHtml + content + postHtml;

    const blob = new Blob(['\ufeff', html], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="container">
      <header>
        <h1>Trình Tạo Kế Hoạch Bài Giảng</h1>
        <p>Tải lên tài liệu và để AI giúp bạn soạn giáo án đầy sáng tạo!</p>
      </header>

      <section className="card">
        <div className="form-group">
          <label htmlFor="topic">Chủ đề bài học</label>
          <input
            type="text"
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ví dụ: Quang hợp ở thực vật"
            aria-required="true"
          />
        </div>
        <div className="form-group">
            <label htmlFor="duration">Thời lượng</label>
            <select
                id="duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
            >
                <option value="35 phút">35 phút</option>
                <option value="45 phút">45 phút</option>
            </select>
        </div>
        <div className="form-group">
          <label htmlFor="file-upload">Tệp tài liệu tham khảo</label>
          <input
            type="file"
            id="file-upload"
            onChange={handleFileChange}
            aria-required="true"
            multiple
          />
        </div>
         {files.length > 0 && (
          <div className="file-list">
            <h4>Các tệp đã chọn:</h4>
            <ul>
              {files.map((file, index) => (
                <li key={index}>{file.name}</li>
              ))}
            </ul>
          </div>
        )}
        <button className="btn" onClick={handleGenerate} disabled={isLoading}>
          {isLoading ? 'Đang tạo...' : 'Tạo kế hoạch'}
        </button>
      </section>

      <section className="results-container">
        {isLoading && <div className="loading-indicator">Đang tạo kế hoạch, vui lòng chờ...</div>}
        {error && <div className="error-message">{error}</div>}
        {lessonPlan && (
          <div className="card">
            <div className="results-header">
              <h2>Kế Hoạch Bài Giảng Chi Tiết</h2>
              <button className="btn btn-secondary" onClick={handleDownload}>
                Tải xuống
              </button>
            </div>
            <div 
              className="lesson-plan" 
              aria-live="polite"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(lessonPlan) }}
            ></div>
          </div>
        )}
      </section>
    </main>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);