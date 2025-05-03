import { useState } from 'react'
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Button,
  Stack,
  TextField,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material'
import { PDFDocument, rgb } from 'pdf-lib'
import './App.css'

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [pagesPerSheet, setPagesPerSheet] = useState(2)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile)
      setError('')
    } else {
      setError('Please select a valid PDF file')
      setFile(null)
    }
  }

  const handleGenerateBooklet = async () => {
    if (!file) {
      setError('Please select a PDF file first')
      return
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      const srcPdf = await PDFDocument.load(arrayBuffer)
      const totalPages = srcPdf.getPageCount()
      const srcPage = srcPdf.getPage(0)
      const { width, height } = srcPage.getSize()
      
      // Calculate dimensions based on pages per sheet
      const bookletWidth = width * (pagesPerSheet === 2 ? 2 : 2)
      const bookletHeight = height * (pagesPerSheet === 2 ? 1 : 2)

      // Calculate number of sheets needed
      const pagesPerSheetTotal = pagesPerSheet * 2 // Each sheet has 2 sides
      const bookletPages = Math.ceil(totalPages / pagesPerSheetTotal) * pagesPerSheetTotal

      const newPdf = await PDFDocument.create()

      // Helper to embed a real or blank page
      const embedOrBlank = async (idx: number) => {
        if (idx < totalPages) {
          return await newPdf.embedPage(srcPdf.getPage(idx))
        } else {
          // Create a blank page in a temp PDF and embed it
          const blankPdf = await PDFDocument.create()
          const blankPage = blankPdf.addPage([width, height])
          // Create a minimal content stream with a white background
          blankPage.drawText('', { x: 0, y: 0 })
          return await newPdf.embedPage(blankPage)
        }
      }

      // Compute booklet page order (imposition)
      const pageOrder: number[] = []
      let left = 0
      let right = bookletPages - 1
      while (left < right) {
        if (pagesPerSheet === 2) {
          // 2-up layout
          pageOrder.push(right)
          pageOrder.push(left)
          pageOrder.push(left + 1)
          pageOrder.push(right - 1)
          left += 2
          right -= 2
        } else {
          // 4-up layout
          pageOrder.push(right)
          pageOrder.push(right - 1)
          pageOrder.push(left)
          pageOrder.push(left + 1)
          pageOrder.push(left + 2)
          pageOrder.push(left + 3)
          pageOrder.push(right - 2)
          pageOrder.push(right - 3)
          left += 4
          right -= 4
        }
      }

      for (let i = 0; i < pageOrder.length; i += pagesPerSheet) {
        const indices = pageOrder.slice(i, i + pagesPerSheet)
        const embeddedPages = await Promise.all(
          indices.map(idx => embedOrBlank(idx))
        )

        // Create a new sheet
        const sheet = newPdf.addPage([bookletWidth, bookletHeight])
        
        if (pagesPerSheet === 2) {
          // 2-up layout
          sheet.drawPage(embeddedPages[0], { x: 0, y: 0, width, height })
          sheet.drawPage(embeddedPages[1], { x: width, y: 0, width, height })
        } else {
          // 4-up layout (2x2 grid)
          sheet.drawPage(embeddedPages[0], { x: 0, y: height, width, height })
          sheet.drawPage(embeddedPages[1], { x: width, y: height, width, height })
          sheet.drawPage(embeddedPages[2], { x: 0, y: 0, width, height })
          sheet.drawPage(embeddedPages[3], { x: width, y: 0, width, height })
        }
      }

      const pdfBytes = await newPdf.save()
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `booklet-${file.name}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSuccess('Booklet PDF generated and downloaded!')
    } catch (err) {
      setError('Error processing PDF file')
      console.error(err)
    }
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center">
          Booklet Maker
        </Typography>
        
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Stack spacing={3}>
            <Box>
              <input
                accept="application/pdf"
                style={{ display: 'none' }}
                id="pdf-file-input"
                type="file"
                onChange={handleFileChange}
              />
              <label htmlFor="pdf-file-input">
                <Button variant="contained" component="span">
                  Upload PDF
                </Button>
              </label>
              {file && (
                <Typography variant="body1" sx={{ mt: 1 }}>
                  Selected file: {file.name}
                </Typography>
              )}
            </Box>

            <FormControl fullWidth>
              <InputLabel id="pages-per-sheet-label">Pages per sheet</InputLabel>
              <Select
                labelId="pages-per-sheet-label"
                id="pages-per-sheet"
                value={pagesPerSheet}
                label="Pages per sheet"
                onChange={e => setPagesPerSheet(Number(e.target.value))}
              >
                <MenuItem value={2}>2</MenuItem>
                <MenuItem value={4}>4</MenuItem>
              </Select>
            </FormControl>

            <Button 
              variant="contained" 
              color="primary"
              onClick={handleGenerateBooklet}
              disabled={!file}
            >
              Generate Booklet
            </Button>
          </Stack>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}
      </Box>
    </Container>
  )
}

export default App
