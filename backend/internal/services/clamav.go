package services

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

// ClamAVScanResult represents the result of a ClamAV scan
type ClamAVScanResult struct {
	IsClean    bool
	Infected   bool
	ScanOutput string
	ScanError  error
	ScanTime   time.Duration
}

// ScanFileWithClamAV scans a file using ClamAV
func ScanFileWithClamAV(filePath string) *ClamAVScanResult {
	startTime := time.Now()

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return &ClamAVScanResult{
			IsClean:    false,
			Infected:   false,
			ScanError:  fmt.Errorf("file does not exist: %s", filePath),
			ScanTime:   time.Since(startTime),
		}
	}

	cmd := exec.Command("clamscan", "--no-summary", filePath)
	output, err := cmd.CombinedOutput()
	scanTime := time.Since(startTime)

	result := &ClamAVScanResult{
		ScanOutput: string(output),
		ScanError:  err,
		ScanTime:   scanTime,
	}

	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			exitCode := exitError.ExitCode()
			if exitCode == 1 {
				result.Infected = true
				result.IsClean = false
				infectedLine := ""
				for _, line := range strings.Split(string(output), "\n") {
					if strings.Contains(line, "FOUND") {
						infectedLine = line
						break
					}
				}
				if infectedLine != "" {
					result.ScanOutput = infectedLine
				}
				return result
			}
		}
		result.IsClean = false
		return result
	}

	result.IsClean = true
	result.Infected = false
	return result
}

// IsClamAVAvailable checks if ClamAV is installed and accessible
func IsClamAVAvailable() bool {
	cmd := exec.Command("which", "clamscan")
	err := cmd.Run()
	return err == nil
}

// GetClamAVVersion returns the ClamAV version if available
func GetClamAVVersion() string {
	if !IsClamAVAvailable() {
		return "ClamAV not installed"
	}

	cmd := exec.Command("clamscan", "--version")
	output, err := cmd.Output()
	if err != nil {
		return "Unknown"
	}

	return strings.TrimSpace(string(output))
}
