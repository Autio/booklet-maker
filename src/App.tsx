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
  MenuItem,
  Tabs,
  Tab,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material'
import { PDFDocument } from 'pdf-lib'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import './App.css'

interface BookletConfig {
  title: string
  startPage: number
  endPage: number
}

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [pagesPerSheet, setPagesPerSheet] = useState(2)
  const [currentTab, setCurrentTab] = useState(0)
  const [bookletConfigs, setBookletConfigs] = useState<BookletConfig[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false)
  const [newConfig, setNewConfig] = useState<BookletConfig>({
    title: '',
    startPage: 1,
    endPage: 1
  })

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile)
      setError('')
      // Get total pages
      try {
        const arrayBuffer = await selectedFile.arrayBuffer()
        const pdf = await PDFDocument.load(arrayBuffer)
        setTotalPages(pdf.getPageCount())
        setNewConfig(prev => ({ ...prev, endPage: pdf.getPageCount() }))
      } catch (err) {
        setError('Error reading PDF file')
        console.error(err)
      }
    } else {
      setError('Please select a valid PDF file')
      setFile(null)
    }
  }

  const handleAddBookletConfig = () => {
    setBookletConfigs([...bookletConfigs, newConfig])
    setNewConfig({
      title: '',
      startPage: bookletConfigs.length > 0 ? bookletConfigs[bookletConfigs.length - 1].endPage + 1 : 1,
      endPage: totalPages
    })
    setIsConfigDialogOpen(false)
  }

  const handleRemoveBookletConfig = (index: number) => {
    setBookletConfigs(bookletConfigs.filter((_, i) => i !== index))
  }

  const handleGenerateBooklet = async () => {
    if (!file) {
      setError('Please select a PDF file first')
      return
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      const srcPdf = await PDFDocument.load(arrayBuffer)
      const srcPage = srcPdf.getPage(0)
      const { width, height } = srcPage.getSize()
      
      // Calculate dimensions based on pages per sheet
      const bookletWidth = width * (pagesPerSheet === 2 ? 2 : 2)
      const bookletHeight = height * (pagesPerSheet === 2 ? 1 : 2)

      // Calculate number of sheets needed
      const pagesPerSheetTotal = pagesPerSheet * 2 // Each sheet has 2 sides

      // If no specific booklet configs, generate one booklet with all pages
      const configs = bookletConfigs.length > 0 ? bookletConfigs : [{
        title: 'Complete Booklet',
        startPage: 1,
        endPage: totalPages
      }]

      for (let configIndex = 0; configIndex < configs.length; configIndex++) {
        const config = configs[configIndex]
        const startPage = config.startPage - 1 // Convert to 0-based index
        const endPage = config.endPage
        const bookletPages = Math.ceil((endPage - startPage) / pagesPerSheetTotal) * pagesPerSheetTotal

        // Compute booklet page order (imposition)
        const pageOrder: number[] = []
        let left = startPage
        let right = endPage - 1
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

        const newPdf = await PDFDocument.create()

        // Helper to embed a real or blank page
        const embedOrBlank = async (idx: number) => {
          if (idx >= startPage && idx < endPage) {
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
        a.download = `${config.title || `booklet-${configIndex + 1}`}-${file.name}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

      setSuccess(`Generated ${configs.length} booklet${configs.length > 1 ? 's' : ''}!`)
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
          <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
            <Tab label="Basic" />
            <Tab label="Advanced" disabled={!file} />
          </Tabs>

          <Box sx={{ mt: 3 }}>
            {currentTab === 0 ? (
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
                      Selected file: {file.name} ({totalPages} pages)
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
            ) : (
              <Stack spacing={3}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">Booklet Sections</Typography>
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => setIsConfigDialogOpen(true)}
                  >
                    Add Section
                  </Button>
                </Box>

                <List>
                  {bookletConfigs.map((config, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={config.title || `Section ${index + 1}`}
                        secondary={`Pages ${config.startPage} to ${config.endPage}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton edge="end" onClick={() => handleRemoveBookletConfig(index)}>
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>

                <Button 
                  variant="contained" 
                  color="primary"
                  onClick={handleGenerateBooklet}
                  disabled={!file}
                >
                  Generate Booklets
                </Button>
              </Stack>
            )}
          </Box>
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

      <Dialog open={isConfigDialogOpen} onClose={() => setIsConfigDialogOpen(false)}>
        <DialogTitle>Add Booklet Section</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Section Title"
              value={newConfig.title}
              onChange={e => setNewConfig({ ...newConfig, title: e.target.value })}
              fullWidth
            />
            <TextField
              label="Start Page"
              type="number"
              value={newConfig.startPage}
              onChange={e => setNewConfig({ ...newConfig, startPage: parseInt(e.target.value) })}
              inputProps={{ min: 1, max: totalPages }}
              fullWidth
            />
            <TextField
              label="End Page"
              type="number"
              value={newConfig.endPage}
              onChange={e => setNewConfig({ ...newConfig, endPage: parseInt(e.target.value) })}
              inputProps={{ min: newConfig.startPage, max: totalPages }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsConfigDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddBookletConfig} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default App
