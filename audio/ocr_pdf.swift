// ocr_pdf.swift: Read text out of a scanned PDF with Apple's Vision framework.
// Pages are separated by form feeds. macOS only.
//
// Build and run:
//   swiftc -O audio/ocr_pdf.swift -o ocr_pdf
//   ./ocr_pdf scanned.pdf scanned.txt


import Foundation
import PDFKit
import Vision
import AppKit

let args = CommandLine.arguments
guard args.count == 3, let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
    FileHandle.standardError.write("usage: ocr_pdf <input.pdf> <output.txt>\n".data(using: .utf8)!)
    exit(1)
}

var pages: [String] = []
for i in 0..<doc.pageCount {
    guard let page = doc.page(at: i) else { pages.append(""); continue }
    let bounds = page.bounds(for: .mediaBox)
    let scale: CGFloat = 2.5
    let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
    let img = NSImage(size: size)
    img.lockFocus()
    NSColor.white.setFill()
    NSRect(origin: .zero, size: size).fill()
    let ctx = NSGraphicsContext.current!.cgContext
    ctx.scaleBy(x: scale, y: scale)
    ctx.translateBy(x: -bounds.origin.x, y: -bounds.origin.y)
    page.draw(with: .mediaBox, to: ctx)
    img.unlockFocus()
    guard let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { pages.append(""); continue }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["en-US"]
    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    do {
        try handler.perform([request])
        let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
        pages.append(lines.joined(separator: "\n"))
    } catch { pages.append("") }
}
try pages.joined(separator: "\n\u{0C}\n").write(toFile: args[2], atomically: true, encoding: .utf8)
print("OK \(doc.pageCount)p")
