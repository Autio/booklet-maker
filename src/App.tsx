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
  DialogActions,
  Switch,
  FormControlLabel,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip
} from '@mui/material'
import { PDFDocument, rgb, degrees, PDFPage } from 'pdf-lib'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import './App.css'

interface BookletConfig {
  title: string
  startPage: number
  endPage: number
  pageNumbers: boolean
  pageNumberPosition: 'top' | 'bottom'
  backCover: boolean
  backCoverText: string
  backFlipping: boolean
  landscape: boolean
  rtl: boolean
  watermark: boolean
  watermarkText: string
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
  const [advancedOptions, setAdvancedOptions] = useState<Omit<BookletConfig, 'title' | 'startPage' | 'endPage'>>({
    pageNumbers: false,
    pageNumberPosition: 'bottom',
    backCover: false,
    backCoverText: '',
    backFlipping: false,
    landscape: false,
    rtl: false,
    watermark: false,
    watermarkText: 'BOOKLET MAKER'
  })
  const [newConfig, setNewConfig] = useState<BookletConfig>({
    title: '',
    startPage: 1,
    endPage: 1,
    ...advancedOptions
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
      endPage: totalPages,
      ...advancedOptions
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
      
      // Calculate dimensions based on pages per sheet and orientation
      const isLandscape = currentTab === 0 ? advancedOptions.landscape : bookletConfigs.some(config => config.landscape)
      const bookletWidth = width * (pagesPerSheet === 2 ? 2 : 2) * (isLandscape ? 1 : 1)
      const bookletHeight = height * (pagesPerSheet === 2 ? 1 : 2) * (isLandscape ? 1 : 1)

      // Calculate number of sheets needed
      const pagesPerSheetTotal = pagesPerSheet * 2 // Each sheet has 2 sides

      // If no specific booklet configs, generate one booklet with all pages
      const configs = currentTab === 0 ? [{
        title: 'Complete Booklet',
        startPage: 1,
        endPage: totalPages,
        ...advancedOptions
      }] : bookletConfigs

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
            if (config.rtl) {
              // RTL order
              pageOrder.push(left)
              pageOrder.push(right)
              // For back pages, if back flipping is enabled, swap the order
              if (config.backFlipping) {
                pageOrder.push(left + 1)
                pageOrder.push(right - 1)
              } else {
                pageOrder.push(right - 1)
                pageOrder.push(left + 1)
              }
            } else {
              // LTR order
              pageOrder.push(right)
              pageOrder.push(left)
              // For back pages, if back flipping is enabled, swap the order
              if (config.backFlipping) {
                pageOrder.push(left + 1)
                pageOrder.push(right - 1)
              } else {
                pageOrder.push(right - 1)
                pageOrder.push(left + 1)
              }
            }
            left += 2
            right -= 2
          } else {
            // 4-up layout
            if (config.rtl) {
              // RTL order
              pageOrder.push(left)
              pageOrder.push(left + 1)
              pageOrder.push(right)
              pageOrder.push(right - 1)
              // For back pages, if back flipping is enabled, swap the order
              if (config.backFlipping) {
                pageOrder.push(left + 2)
                pageOrder.push(left + 3)
                pageOrder.push(right - 2)
                pageOrder.push(right - 3)
              } else {
                pageOrder.push(right - 2)
                pageOrder.push(right - 3)
                pageOrder.push(left + 2)
                pageOrder.push(left + 3)
              }
            } else {
              // LTR order
              pageOrder.push(right)
              pageOrder.push(right - 1)
              pageOrder.push(left)
              pageOrder.push(left + 1)
              // For back pages, if back flipping is enabled, swap the order
              if (config.backFlipping) {
                pageOrder.push(left + 2)
                pageOrder.push(left + 3)
                pageOrder.push(right - 2)
                pageOrder.push(right - 3)
              } else {
                pageOrder.push(right - 2)
                pageOrder.push(right - 3)
                pageOrder.push(left + 2)
                pageOrder.push(left + 3)
              }
            }
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

        // Calculate total number of sheets needed
        const totalSheets = Math.ceil(pageOrder.length / (pagesPerSheet * 2))
        console.log('Total sheets:', totalSheets)
        console.log('Pages per sheet:', pagesPerSheet)
        console.log('Back flipping enabled:', config.backFlipping)
        console.log('Page order:', pageOrder)

        // Create all sheets upfront
        const sheets = Array.from({ length: totalSheets * 2 }, () => 
          newPdf.addPage([bookletWidth, bookletHeight])
        )

        // Process pages in pairs (front and back)
        for (let i = 0; i < pageOrder.length; i += pagesPerSheet * 2) {
          // Get pages for front and back of sheet
          const frontIndices = pageOrder.slice(i, i + pagesPerSheet)
          const backIndices = pageOrder.slice(i + pagesPerSheet, i + pagesPerSheet * 2)
          
          console.log(`Sheet ${Math.floor(i / (pagesPerSheet * 2)) + 1}:`, {
            frontIndices,
            backIndices
          })

          const frontPages = await Promise.all(frontIndices.map(idx => embedOrBlank(idx)))
          const backPages = await Promise.all(backIndices.map(idx => embedOrBlank(idx)))

          // Calculate sheet indices
          const sheetIndex = Math.floor(i / (pagesPerSheet * 2))
          const frontSheetIndex = sheetIndex * 2
          const backSheetIndex = frontSheetIndex + 1

          if (pagesPerSheet === 2) {
            // 2-up layout - Front
            sheets[frontSheetIndex].drawPage(frontPages[0], { 
              x: 0, 
              y: 0, 
              width, 
              height,
              rotate: config.landscape ? degrees(90) : undefined
            })
            sheets[frontSheetIndex].drawPage(frontPages[1], { 
              x: width, 
              y: 0, 
              width, 
              height,
              rotate: config.landscape ? degrees(90) : undefined
            })
            drawWatermark(sheets[frontSheetIndex], bookletWidth, bookletHeight)

            // Back side
            if (backPages.length > 0) {
              const backRotation = config.landscape ? degrees(90) : undefined
              sheets[backSheetIndex].drawPage(backPages[0], { 
                x: 0, 
                y: 0, 
                width, 
                height,
                rotate: backRotation
              })
              sheets[backSheetIndex].drawPage(backPages[1], { 
                x: width, 
                y: 0, 
                width, 
                height,
                rotate: backRotation
              })
              drawWatermark(sheets[backSheetIndex], bookletWidth, bookletHeight)
            }
          } else {
            // 4-up layout - Front
            sheets[frontSheetIndex].drawPage(frontPages[0], { 
              x: 0, 
              y: height, 
              width, 
              height,
              rotate: config.landscape ? degrees(90) : undefined
            })
            sheets[frontSheetIndex].drawPage(frontPages[1], { 
              x: width, 
              y: height, 
              width, 
              height,
              rotate: config.landscape ? degrees(90) : undefined
            })
            sheets[frontSheetIndex].drawPage(frontPages[2], { 
              x: 0, 
              y: 0, 
              width, 
              height,
              rotate: config.landscape ? degrees(90) : undefined
            })
            sheets[frontSheetIndex].drawPage(frontPages[3], { 
              x: width, 
              y: 0, 
              width, 
              height,
              rotate: config.landscape ? degrees(90) : undefined
            })
            drawWatermark(sheets[frontSheetIndex], bookletWidth, bookletHeight)

            // Back side
            if (backPages.length > 0) {
              const backRotation = config.landscape ? degrees(90) : undefined
              sheets[backSheetIndex].drawPage(backPages[0], { 
                x: 0, 
                y: height, 
                width, 
                height,
                rotate: backRotation
              })
              sheets[backSheetIndex].drawPage(backPages[1], { 
                x: width, 
                y: height, 
                width, 
                height,
                rotate: backRotation
              })
              sheets[backSheetIndex].drawPage(backPages[2], { 
                x: 0, 
                y: 0, 
                width, 
                height,
                rotate: backRotation
              })
              sheets[backSheetIndex].drawPage(backPages[3], { 
                x: width, 
                y: 0, 
                width, 
                height,
                rotate: backRotation
              })
              drawWatermark(sheets[backSheetIndex], bookletWidth, bookletHeight)
            }
          }

          // Add page numbers if enabled
          if (config.pageNumbers) {
            const pageNumber = Math.floor(i / pagesPerSheet) + 1
            const y = config.pageNumberPosition === 'top' ? bookletHeight - 20 : 20
            sheets[frontSheetIndex].drawText(`${pageNumber}`, {
              x: bookletWidth / 2,
              y,
              size: 12,
              color: rgb(0, 0, 0)
            })
          }
        }

        // Add back cover if enabled
        if (config.backCover) {
          const backCover = newPdf.addPage([bookletWidth, bookletHeight])
          backCover.drawText(config.backCoverText || config.title, {
            x: bookletWidth / 2,
            y: bookletHeight / 2,
            size: 24,
            color: rgb(0, 0, 0)
          })
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

  const drawWatermark = (page: PDFPage, width: number, height: number) => {
    const config = currentTab === 0 ? advancedOptions : newConfig
    if (!config.watermark) return

    // Calculate font size based on page dimensions (smaller than before)
    const fontSize = Math.min(width, height) / 40

    // Draw the watermark text
    const text = config.watermarkText
    const textWidth = text.length * (fontSize * 0.6) // Approximate width based on character count and font size
    const textHeight = fontSize

    // Position in bottom right with padding
    const padding = fontSize * 2
    const x = width - textWidth - padding
    const y = padding

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      color: rgb(0.8, 0.8, 0.8), // Light gray color
      opacity: 0.3 // Semi-transparent
    })
  }

  const renderAdvancedOptions = () => (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>Advanced Options</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={currentTab === 0 ? advancedOptions.pageNumbers : newConfig.pageNumbers}
                onChange={e => {
                  if (currentTab === 0) {
                    setAdvancedOptions(prev => ({ ...prev, pageNumbers: e.target.checked }))
                  } else {
                    setNewConfig(prev => ({ ...prev, pageNumbers: e.target.checked }))
                  }
                }}
              />
            }
            label="Add Page Numbers"
          />
          {(currentTab === 0 ? advancedOptions.pageNumbers : newConfig.pageNumbers) && (
            <FormControl fullWidth>
              <InputLabel>Page Number Position</InputLabel>
              <Select
                value={currentTab === 0 ? advancedOptions.pageNumberPosition : newConfig.pageNumberPosition}
                label="Page Number Position"
                onChange={e => {
                  if (currentTab === 0) {
                    setAdvancedOptions(prev => ({ 
                      ...prev, 
                      pageNumberPosition: e.target.value as 'top' | 'bottom' 
                    }))
                  } else {
                    setNewConfig(prev => ({ 
                      ...prev, 
                      pageNumberPosition: e.target.value as 'top' | 'bottom' 
                    }))
                  }
                }}
              >
                <MenuItem value="top">Top</MenuItem>
                <MenuItem value="bottom">Bottom</MenuItem>
              </Select>
            </FormControl>
          )}

          <FormControlLabel
            control={
              <Switch
                checked={currentTab === 0 ? advancedOptions.backCover : newConfig.backCover}
                onChange={e => {
                  if (currentTab === 0) {
                    setAdvancedOptions(prev => ({ ...prev, backCover: e.target.checked }))
                  } else {
                    setNewConfig(prev => ({ ...prev, backCover: e.target.checked }))
                  }
                }}
              />
            }
            label="Add Back Cover"
          />
          {(currentTab === 0 ? advancedOptions.backCover : newConfig.backCover) && (
            <TextField
              label="Back Cover Text"
              value={currentTab === 0 ? advancedOptions.backCoverText : newConfig.backCoverText}
              onChange={e => {
                if (currentTab === 0) {
                  setAdvancedOptions(prev => ({ ...prev, backCoverText: e.target.value }))
                } else {
                  setNewConfig(prev => ({ ...prev, backCoverText: e.target.value }))
                }
              }}
              placeholder="Leave empty to use section title"
              fullWidth
            />
          )}

          <FormControlLabel
            control={
              <Switch
                checked={currentTab === 0 ? advancedOptions.backFlipping : newConfig.backFlipping}
                onChange={e => {
                  if (currentTab === 0) {
                    setAdvancedOptions(prev => ({ ...prev, backFlipping: e.target.checked }))
                  } else {
                    setNewConfig(prev => ({ ...prev, backFlipping: e.target.checked }))
                  }
                }}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Back Flipping
                <Tooltip title="When enabled, the back side of each sheet will be flipped horizontally. This is useful for double-sided printing where you want the content to be readable when flipping the page like a book.">
                  <HelpOutlineIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </Tooltip>
              </Box>
            }
          />

          <FormControlLabel
            control={
              <Switch
                checked={currentTab === 0 ? advancedOptions.landscape : newConfig.landscape}
                onChange={e => {
                  if (currentTab === 0) {
                    setAdvancedOptions(prev => ({ ...prev, landscape: e.target.checked }))
                  } else {
                    setNewConfig(prev => ({ ...prev, landscape: e.target.checked }))
                  }
                }}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Landscape Orientation
                <Tooltip title="When enabled, pages will be rotated 90 degrees clockwise. This is useful for landscape-oriented content that needs to be printed in portrait orientation.">
                  <HelpOutlineIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </Tooltip>
              </Box>
            }
          />

          <FormControlLabel
            control={
              <Switch
                checked={currentTab === 0 ? advancedOptions.rtl : newConfig.rtl}
                onChange={e => {
                  if (currentTab === 0) {
                    setAdvancedOptions(prev => ({ ...prev, rtl: e.target.checked }))
                  } else {
                    setNewConfig(prev => ({ ...prev, rtl: e.target.checked }))
                  }
                }}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Right-to-Left (RTL)
                <Tooltip title="When enabled, the page order will be reversed for right-to-left languages. This is useful for languages like Arabic, Hebrew, or Persian where content flows from right to left.">
                  <HelpOutlineIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </Tooltip>
              </Box>
            }
          />

          <FormControlLabel
            control={
              <Switch
                checked={currentTab === 0 ? advancedOptions.watermark : newConfig.watermark}
                onChange={e => {
                  if (currentTab === 0) {
                    setAdvancedOptions(prev => ({ ...prev, watermark: e.target.checked }))
                  } else {
                    setNewConfig(prev => ({ ...prev, watermark: e.target.checked }))
                  }
                }}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Watermark
                <Tooltip title="Add a subtle watermark to each page. Disable for a cleaner look.">
                  <HelpOutlineIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </Tooltip>
              </Box>
            }
          />
          {(currentTab === 0 ? advancedOptions.watermark : newConfig.watermark) && (
            <TextField
              label="Watermark Text"
              value={currentTab === 0 ? advancedOptions.watermarkText : newConfig.watermarkText}
              onChange={e => {
                if (currentTab === 0) {
                  setAdvancedOptions(prev => ({ ...prev, watermarkText: e.target.value }))
                } else {
                  setNewConfig(prev => ({ ...prev, watermarkText: e.target.value }))
                }
              }}
              placeholder="Enter watermark text"
              fullWidth
            />
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  )

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

                {renderAdvancedOptions()}

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
                        secondary={
                          <Stack spacing={1}>
                            <Typography variant="body2">
                              Pages {config.startPage} to {config.endPage}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {[
                                config.pageNumbers && 'Page Numbers',
                                config.backCover && 'Back Cover',
                                config.backFlipping && 'Back Flipping',
                                config.landscape && 'Landscape',
                                config.rtl && 'RTL'
                              ].filter(Boolean).join(', ') || 'No special features'}
                            </Typography>
                          </Stack>
                        }
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

        {/* Banner Ad */}
        <Paper 
          elevation={0} 
          sx={{ 
            mt: 4, 
            p: 2, 
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Made with ❤️ by Booklet Maker
          </Typography>
          <Button 
            variant="outlined" 
            size="small"
            href="https://bookletmaker.com/pro"
            target="_blank"
            rel="noopener noreferrer"
          >
            Upgrade to Pro
          </Button>
        </Paper>
      </Box>

      <Dialog 
        open={isConfigDialogOpen} 
        onClose={() => setIsConfigDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Booklet Section</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
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

            <Divider />

            {renderAdvancedOptions()}
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
