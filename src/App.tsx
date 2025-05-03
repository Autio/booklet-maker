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
      // Auto paper size: width is doubled
      const bookletWidth = width * 2
      const bookletHeight = height

      // Calculate number of sheets needed
      const pagesPerSheet = 2 // Each sheet has 4 pages (2 per side)
      const bookletPages = Math.ceil(totalPages / 4) * 4 // Pad to multiple of 4

      // Compute booklet page order (imposition)
      const pageOrder: number[] = []
      let left = 0
      let right = bookletPages - 1
      while (left < right) {
        pageOrder.push(right)
        pageOrder.push(left)
        pageOrder.push(left + 1)
        pageOrder.push(right - 1)
        left += 2
        right -= 2
      }

      const newPdf = await PDFDocument.create()
      for (let i = 0; i < pageOrder.length; i += 2) {
        const indices = [pageOrder[i], pageOrder[i + 1]]
        const [srcIdxA, srcIdxB] = indices
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
        const embeddedA = await embedOrBlank(srcIdxA)
        const embeddedB = await embedOrBlank(srcIdxB)
        // Create a new sheet (one side)
        const sheet = newPdf.addPage([bookletWidth, bookletHeight])
        sheet.drawPage(embeddedA, { x: 0, y: 0, width, height })
        sheet.drawPage(embeddedB, { x: width, y: 0, width, height })
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
