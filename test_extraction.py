#!/usr/bin/env python3
import sys
import os
import tempfile
try:
    import PyPDF2
    print("PyPDF2 imported successfully")
    # Test basic functionality
    print("Python text extraction script is accessible")
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)

