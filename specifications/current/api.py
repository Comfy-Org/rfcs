from abc import ABC, abstractmethod

'''
ComfyUI API available to custom nodes.
'''
class ComfyUI(ABC):
    @abstractmethod
    def some_method(self):
        pass
