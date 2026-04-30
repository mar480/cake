"""
XBRL taxonomy loader module.

This module provides functionality to load XBRL taxonomies and initialize
extractors for concepts and hypercubes.
"""

from arelle import Cntlr
from .concept_extractor import ConceptDetailsExtractor
from .hypercube_extractor import HypercubeDiscoverer


class TaxonomyContext:
    """
    Context manager for XBRL taxonomy operations.
    
    This class provides a centralized way to load XBRL taxonomies and access
    concept and hypercube extractors for processing taxonomy data.
    
    Attributes:
        controller: Arelle controller instance
        model: Loaded XBRL model
        concepts: Concept details extractor
        hypercubes: Hypercube discoverer
    """
    
    def __init__(self, entrypoint_path: str):
        """
        Initialize the taxonomy context with a given entrypoint.
        
        Args:
            entrypoint_path (str): Path to the XBRL taxonomy entrypoint file
        """
        self.controller = Cntlr.Cntlr()
        self.model = self.controller.modelManager.load(entrypoint_path)
        self.concepts = ConceptDetailsExtractor(self.model)
        self.hypercubes = HypercubeDiscoverer(self.model)
