"""Lead360 Voice AI Agent - Main Entry Point"""
import logging
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    logger.info("Lead360 Voice AI Agent starting...")
    from .worker import run
    run()


if __name__ == "__main__":
    main()
